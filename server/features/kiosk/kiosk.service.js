import bcrypt from "bcrypt";
import { createHash, createHmac, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import config from "../../../config/config.js";
import { withTransaction } from "../../db/pool.js";
import { badRequest, conflict, forbidden, HttpError, notFound } from "../../lib/http-error.js";
import { finishEventNow, markCheckedIn, releaseAbandonedRoomBookings } from "../events/event.repository.js";
import { hasDoorCard } from "../auth/auth.repository.js";
import { formatLocalTime, zonedParts, zonedPartsToDate } from "../events/event-time.js";
import { calendarRange, createEvents } from "../events/event.service.js";
import { getSettings } from "../settings/setting.repository.js";
import {
  createKioskDevice,
  extendKioskRoomEvent,
  findActiveKioskDeviceById,
  findActiveKioskDeviceForRoom,
  findEmployeeByCard,
  findKioskEventActionContext,
  findKioskRoomEvent,
  findKioskRoomByLogin,
  listKioskDevices,
  listKioskScheduleRows,
  revokeKioskDevice,
  touchKioskDevice,
  rotateKioskRefreshToken,
  updateKioskDeviceCapabilities,
} from "./kiosk.repository.js";

export const publicKioskRoom = (room) => ({
  _id: room._id,
  name: room.name,
  email: room.email,
  type: "room",
  floor: room.floor,
  capacity: room.capacity,
  building: room.building,
  feature: room.feature,
});

const roomFromDevice = (device) => ({
  _id: device.room_id,
  name: device.room_name,
  email: device.room_email,
  type: "room",
  floor: device.floor,
  capacity: device.capacity,
  building: device.building,
  feature: device.feature,
});

// Time units and booking limits are named once so the rules cannot drift apart.
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
// A device counts as online while it keeps sending requests within this window.
const KIOSK_ONLINE_WINDOW_MS = 60 * 1000;
const MIN_BOOKING_MINUTES = 5;
const MAX_BOOKING_MINUTES = 240;
const DEFAULT_INSTANT_MINUTES = 30;
const SCHEDULE_LOOKAHEAD_HOURS = 36;

// One place decides the device lifecycle state shown in the CMS.
const deviceStatus = (device) => {
  if (device.revoked_at) return "revoked";
  if (device.refresh_expires_at && new Date(device.refresh_expires_at) <= new Date()) return "expired";
  return "active";
};

export const publicKioskDevice = (device) => ({
  id: device.device_id,
  name: device.device_name,
  roomId: device.room_id,
  roomName: device.room_name,
  roomEmail: device.room_email,
  status: deviceStatus(device),
  online: Boolean(!device.revoked_at
    && device.last_seen_at
    && Date.now() - new Date(device.last_seen_at).getTime() <= KIOSK_ONLINE_WINDOW_MS),
  lastSeenAt: device.last_seen_at,
  refreshExpiresAt: device.refresh_expires_at,
  createdAt: device.created_at,
  revokedAt: device.revoked_at,
  nfcEnabled: Boolean(device.nfc_enabled),
  ledEnabled: Boolean(device.led_enabled),
  showSubject: Boolean(device.show_subject),
});

export const authenticateKioskCredentials = async (login, password) => {
  if (!login || !password) throw new HttpError(401, "INVALID_KIOSK_CREDENTIALS", "Invalid room login or password");
  const room = await findKioskRoomByLogin(login);
  const valid = room?.password && await bcrypt.compare(String(password), room.password);
  if (!valid) throw new HttpError(401, "INVALID_KIOSK_CREDENTIALS", "Invalid room login or password");
  return room;
};

export const signKioskToken = (device) => jwt.sign(
  { kind: "kiosk", room_id: String(device.room_id), ver: Number(device.token_version) },
  config.jwtSecret,
  {
    algorithm: "HS256",
    subject: String(device.device_id),
    expiresIn: config.kioskJwtExpiry,
    issuer: config.jwtIssuer,
    audience: config.kioskJwtAudience,
  }
);

const newRefreshToken = () => randomBytes(32).toString("base64url");
const hashRefreshToken = (token) => createHash("sha256").update(String(token || "")).digest("hex");
const successorRefreshToken = (token) => createHmac("sha256", config.jwtSecret)
  .update("360booking:kiosk-refresh:")
  .update(String(token))
  .digest("base64url");
const refreshExpiry = () => new Date(Date.now() + config.kioskRefreshDays * 86_400_000);
const cleanDeviceName = (value, room) => String(value || `${room.name} Tablet`).trim().slice(0, 80) || `${room.name} Tablet`;

const kioskSession = (device, refreshToken) => ({
  token: signKioskToken(device),
  refreshToken,
  room: publicKioskRoom(roomFromDevice(device)),
  device: publicKioskDevice(device),
});

export const provisionKioskDevice = async ({ login, password, deviceName }) => {
  const room = await authenticateKioskCredentials(login, password);
  // A room may only have one active tablet. Re-pairing must go through revoking the
  // old device in the CMS so it cannot be taken over.
  const existing = await findActiveKioskDeviceForRoom(room._id);
  if (existing) {
    throw conflict(
      "ROOM_ALREADY_PAIRED",
      "This room already has an active tablet. Revoke the old device in the CMS (Tablet Devices) before pairing again."
    );
  }
  const refreshToken = newRefreshToken();
  const device = await createKioskDevice({
    roomId: room._id,
    name: cleanDeviceName(deviceName, room),
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshExpiresAt: refreshExpiry(),
  });
  return kioskSession(device, refreshToken);
};

export const refreshKioskDeviceSession = async (refreshToken) => {
  if (!refreshToken) throw new HttpError(401, "INVALID_KIOSK_REFRESH", "Kiosk provisioning required");
  const nextRefreshToken = successorRefreshToken(refreshToken);
  const device = await rotateKioskRefreshToken({
    refreshTokenHash: hashRefreshToken(refreshToken),
    nextHash: hashRefreshToken(nextRefreshToken),
    refreshExpiresAt: refreshExpiry(),
  });
  if (!device) throw new HttpError(401, "INVALID_KIOSK_REFRESH", "Kiosk provisioning required");
  return kioskSession(device, nextRefreshToken);
};

export const verifyKioskToken = async (token) => {
  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: config.jwtIssuer,
      audience: config.kioskJwtAudience,
    });
  } catch {
    throw new HttpError(401, "INVALID_KIOSK_TOKEN", "Kiosk authentication required");
  }
  if (claims.kind !== "kiosk") throw new HttpError(401, "INVALID_KIOSK_TOKEN", "Kiosk authentication required");
  const device = await findActiveKioskDeviceById(claims.sub);
  if (!device
    || String(claims.room_id) !== String(device.room_id)
    || Number(claims.ver) !== Number(device.token_version)) {
    throw new HttpError(401, "INACTIVE_KIOSK_DEVICE", "Kiosk authentication required");
  }
  try {
    await touchKioskDevice(device.device_id);
    device.last_seen_at = new Date();
  } catch {
    // A failure to record last-seen must not block the kiosk.
  }
  const room = publicKioskRoom(roomFromDevice(device));
  return { ...room, kind: "kiosk", roomId: room._id, deviceId: device.device_id, device: publicKioskDevice(device) };
};

export const getKioskContext = async (room) => ({
  room: publicKioskRoom(room),
  device: room.device,
  timezone: config.appTimezone,
  // The tablet's internal clock often drifts; the tablet uses this time to calibrate
  // the clock it displays every time it connects successfully.
  serverTime: new Date().toISOString(),
  settings: (await getSettings()) || {},
});

export const authorizeKioskDoor = async (cardNumber, room) => {
  const value = String(cardNumber ?? "").trim();
  if (!value) throw badRequest("INVALID_CARD", "Card number is required");
  if (!(await hasDoorCard(value))) throw badRequest("INVALID_CARD", "Card number not found");
  return { roomId: room._id, deviceId: room.deviceId };
};

export const deprovisionKioskDevice = async (deviceId) => {
  const device = await revokeKioskDevice(deviceId);
  if (!device) throw notFound("Kiosk device not found");
  return device;
};

export const getManagedKioskDevices = async (roomId) => (await listKioskDevices(roomId)).map(publicKioskDevice);

export const revokeManagedKioskDevice = async (deviceId, principalId) => {
  const device = await revokeKioskDevice(deviceId, principalId);
  if (!device) throw notFound("Kiosk device not found");
  return device;
};

export const updateManagedKioskCapabilities = async (deviceId, input = {}) => {
  const flags = {
    nfcEnabled: Object.hasOwn(input, "nfcEnabled") ? input.nfcEnabled : null,
    ledEnabled: Object.hasOwn(input, "ledEnabled") ? input.ledEnabled : null,
    showSubject: Object.hasOwn(input, "showSubject") ? input.showSubject : null,
  };
  const changedKeys = Object.keys(flags).filter((key) => flags[key] !== null);
  if (!changedKeys.length) {
    throw badRequest("INVALID_KIOSK_CAPABILITIES", "NFC, LED, or subject visibility setting is required");
  }
  for (const key of changedKeys) {
    if (typeof flags[key] !== "boolean") throw badRequest("INVALID_KIOSK_CAPABILITIES", `${key} setting must be boolean`);
  }
  const device = await updateKioskDeviceCapabilities({
    deviceId,
    nfcEnabled: flags.nfcEnabled,
    ledEnabled: flags.ledEnabled,
    showSubject: flags.showSubject,
  });
  if (!device) throw notFound("Kiosk device not found");
  return publicKioskDevice(device);
};

const kioskCapabilities = (row, now = Date.now()) => {
  const start = new Date(row.start_at).getTime();
  const end = new Date(row.end_at).getTime();
  const opens = start - Number(row.early_minutes || 0) * MILLISECONDS_PER_MINUTE;
  const closes = start + Number(row.late_minutes || 0) * MILLISECONDS_PER_MINUTE;
  return {
    canCheckIn: !row.checked_in && now >= opens && now < closes,
    canFinish: Boolean(row.checked_in) && now >= start && now < end,
  };
};

export const getKioskSchedule = async (query, room) => {
  await maybeReleaseAbandonedBookings();
  const range = calendarRange(query.start, query.end, config.appTimezone);
  const rows = await listKioskScheduleRows({ roomId: room._id, ...range });
  // Admin toggle in Tablet Devices: when off, send neither the title nor the full
  // organizer name, so only the time and first name remain visible.
  const revealTitle = Boolean(room.device?.showSubject);
  const cleanSubject = (value) => {
    const text = String(value || "").trim();
    return text.length ? text : null;
  };
  return rows.map((row) => ({
    id: row._id,
    title: `[${row.organizer_first_name || "Booked"}, ${formatLocalTime(row.start_at, row.timezone)} - ${formatLocalTime(row.end_at, row.timezone)}]`,
    subject: revealTitle ? cleanSubject(row.subject) : null,
    organizerName: revealTitle
      ? (cleanSubject(row.organizer_name) || row.organizer_first_name || "Booked")
      : null,
    organizerFirstName: row.organizer_first_name || "Booked",
    start: row.start_at,
    end: row.end_at,
    timezone: row.timezone,
    checkedIn: Boolean(row.checked_in),
    checkedInAt: row.checked_in ? new Date(row.checked_in).toISOString() : null,
    ...kioskCapabilities(row),
  }));
};

const kioskActionContext = async ({ eventId, cardNumber, room }, execute) => {
  if (!eventId || !cardNumber) throw badRequest("INVALID_KIOSK_ACTION", "Event and card number are required");
  const context = await findKioskEventActionContext({ eventId, roomId: room._id, cardNumber }, execute);
  if (!context) throw notFound("Event not found for this room");
  if (!context.card_allowed) throw forbidden("Card is not authorized for this meeting");
  return context;
};

export const checkInKioskEvent = async ({ event_id: eventId, card_number: cardNumber }, room) => {
  return withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    const context = await kioskActionContext({ eventId, cardNumber, room }, execute);
    const now = Date.now();
    const start = new Date(context.start_at).getTime();
    const opens = start - Number(context.early_minutes || 0) * MILLISECONDS_PER_MINUTE;
    const closes = start + Number(context.late_minutes || 0) * MILLISECONDS_PER_MINUTE;
    if (now < opens || now >= closes) throw conflict("CHECK_IN_WINDOW", "Meeting is outside its check-in window");
    if (context.checked_in) throw conflict("ALREADY_CHECKED_IN", "Meeting is already checked in");
    return markCheckedIn(eventId, execute);
  });
};

export const finishKioskEvent = async ({ event_id: eventId, card_number: cardNumber }, room) => {
  return withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    const context = await kioskActionContext({ eventId, cardNumber, room }, execute);
    const now = Date.now();
    if (!context.checked_in || now < new Date(context.start_at).getTime() || now >= new Date(context.end_at).getTime()) {
      throw conflict("EARLY_FINISH_WINDOW", "Only an active checked-in meeting can be finished early");
    }
    return finishEventNow(eventId, execute);
  });
};

// Release no-show bookings before reading the schedule or creating an instant booking.
const maybeReleaseAbandonedBookings = async () => {
  await releaseAbandonedRoomBookings().catch(() => {});
};

const clampMinutes = (value, fallback, min, max) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.min(max, Math.max(min, Math.round(minutes)));
};

// The kiosk card must belong to an active employee whose floor matches the room.
// Used by instant booking and by scheduled booking for today.
const resolveKioskEmployeeByCard = async (cardNumber, room) => {
  const card = String(cardNumber || "").trim();
  if (!card) throw badRequest("INVALID_CARD", "Card number is required");
  const employee = await findEmployeeByCard(card);
  if (!employee) throw badRequest("INVALID_CARD", "Card number not found");
  const employeeFloor = String(employee.floor || "").trim();
  const roomFloor = String(room.floor || "").trim();
  if (!employeeFloor) {
    throw new HttpError(403, "FLOOR_REQUIRED", "This card is not linked to a work floor. Ask an admin to set it in Management > Users.");
  }
  if (employeeFloor.toLowerCase() !== "all" && employeeFloor !== roomFloor) {
    throw new HttpError(403, "FLOOR_RESTRICTED", `This card is registered on floor ${employeeFloor}, but this room is on floor ${roomFloor}.`);
  }
  return employee;
};

const localDayKey = (date, timezone) => {
  const parts = zonedParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

// Rules for scheduled booking from the kiosk: today only (server time zone),
// the start must not be in the past, duration 5-240 minutes, ending on the same day.
export const validateKioskBookedSlot = ({ now, start, end, timezone }) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    throw badRequest("INVALID_TIME", "Start and end times are required");
  }
  if (startDate.getTime() < now.getTime() - MILLISECONDS_PER_MINUTE) {
    throw badRequest("INVALID_TIME", "The start time is already in the past");
  }
  const today = localDayKey(now, timezone);
  if (localDayKey(startDate, timezone) !== today || localDayKey(endDate, timezone) !== today) {
    throw badRequest("INVALID_TIME", "Kiosk bookings are for today only");
  }
  const minutes = (endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_MINUTE;
  if (minutes < MIN_BOOKING_MINUTES || minutes > MAX_BOOKING_MINUTES) {
    throw badRequest("INVALID_TIME", "Booking duration must be 5-240 minutes");
  }
  return { startDate, endDate, startsNow: startDate.getTime() - now.getTime() <= 2 * MILLISECONDS_PER_MINUTE };
};

export const extendKioskEvent = async ({ event_id: eventId, minutes }, room) => {
  if (!eventId) throw badRequest("INVALID_KIOSK_ACTION", "Event is required");
  const extra = clampMinutes(minutes, 15, 5, 60);
  return withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    const context = await findKioskRoomEvent({ eventId, roomId: room._id }, execute);
    if (!context) throw notFound("Event not found for this room");
    const now = Date.now();
    if (!context.checked_in) throw conflict("NOT_CHECKED_IN", "Only a checked-in meeting can be extended");
    if (now < new Date(context.start_at).getTime() || now >= new Date(context.end_at).getTime()) {
      throw conflict("EXTEND_WINDOW", "Only the running meeting can be extended");
    }
    const endAt = new Date(new Date(context.end_at).getTime() + extra * MILLISECONDS_PER_MINUTE).toISOString();
    try {
      const updated = await extendKioskRoomEvent({ eventId, endAt }, execute);
      return { id: updated._id, title: updated.subject, start: updated.start_at, end: updated.end_at, extendedMinutes: extra };
    } catch (error) {
      if (error.code === "23P01") throw conflict("ROOM_CONFLICT", "Room is already booked right after this meeting");
      throw error;
    }
  });
};

export const completeKioskEvent = async ({ event_id: eventId }, room) => {
  if (!eventId) throw badRequest("INVALID_KIOSK_ACTION", "Event is required");
  return withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    const context = await findKioskRoomEvent({ eventId, roomId: room._id }, execute);
    if (!context) throw notFound("Event not found for this room");
    const now = Date.now();
    if (!context.checked_in || now < new Date(context.start_at).getTime() || now >= new Date(context.end_at).getTime()) {
      throw conflict("EARLY_FINISH_WINDOW", "Only an active checked-in meeting can be finished early");
    }
    const finished = await finishEventNow(eventId, execute);
    return { id: eventId, title: context.subject, finishedAt: finished?.end_at || new Date().toISOString() };
  });
};


// Instant booking window: always ends on the same day (server time zone),
// at most 4 hours, or until the next meeting if that is still today.
export const instantBookingWindow = ({ now, nextStart, minutes, untilNext = false, timezone }) => {
  const nowParts = zonedParts(now, timezone);
  const endOfDay = zonedPartsToDate(
    { ...nowParts, hour: 23, minute: 59, second: 59, millisecond: 0 },
    timezone
  );
  const maxEnd = Math.min(now.getTime() + MAX_BOOKING_MINUTES * MILLISECONDS_PER_MINUTE, endOfDay.getTime());
  const nextToday = nextStart && new Date(nextStart).getTime() <= endOfDay.getTime()
    ? new Date(nextStart).getTime()
    : null;
  // The requested duration is always respected. The next meeting is only an upper
  // bound, or the end point when the caller asks for "until next".
  const requestedEnd = untilNext
    ? maxEnd
    : now.getTime() + clampMinutes(minutes, DEFAULT_INSTANT_MINUTES, MIN_BOOKING_MINUTES, MAX_BOOKING_MINUTES) * MILLISECONDS_PER_MINUTE;
  const endMs = Math.min(requestedEnd, maxEnd, nextToday ?? Infinity);
  return {
    start: now,
    end: new Date(endMs),
    untilNext: nextToday !== null && endMs === nextToday,
    endOfDay,
  };
};

export const instantKioskBooking = async ({ card_number: cardNumber, minutes, until_next: untilNextRequested }, room) => {
  await maybeReleaseAbandonedBookings();
  const employee = await resolveKioskEmployeeByCard(cardNumber, room);
  const now = new Date();
  const horizon = new Date(now.getTime() + SCHEDULE_LOOKAHEAD_HOURS * MILLISECONDS_PER_HOUR);
  const rows = await listKioskScheduleRows({ roomId: room._id, rangeStart: now, rangeEnd: horizon });
  const next = rows.find((row) => new Date(row.start_at).getTime() > now.getTime());
  const window = instantBookingWindow({
    now,
    nextStart: next?.start_at,
    minutes,
    untilNext: untilNextRequested === true || untilNextRequested === "true",
    timezone: config.appTimezone,
  });
  if (window.end.getTime() - now.getTime() < MILLISECONDS_PER_MINUTE) {
    throw conflict("NO_FREE_WINDOW", "No time is left today for an instant booking");
  }
  const created = await createEvents(
    [{
      organizer: employee.email,
      subject: `Room usage - ${employee.name}`,
      description: "Instant booking from the kiosk",
      start_date: now.toISOString(),
      end_date: window.end.toISOString(),
      attendee_email: room.email,
    }],
    { _id: employee._id, email: employee.email, name: employee.name, role: "USER", floor: employee.floor }
  );
  const first = Array.isArray(created) ? created[0] : null;
  // An instant booking at the kiosk means the person is already in the room, so
  // the booking is also marked as checked in.
  if (first?.id) await markCheckedIn(first.id);
  return {
    id: first?.id || null,
    title: first?.title || `Room usage - ${employee.name}`,
    organizer: employee.name,
    start: first?.start || now.toISOString(),
    end: first?.end || window.end.toISOString(),
    checkedIn: true,
    untilNext: window.untilNext,
  };
};

// Scheduled booking from the kiosk: the user picks start and end times on the same day.
// When the start is within 2 minutes of now, the booking is checked in right away,
// like an instant booking.
export const bookKioskSlot = async ({ card_number: cardNumber, start, end }, room) => {
  await maybeReleaseAbandonedBookings();
  const employee = await resolveKioskEmployeeByCard(cardNumber, room);
  const now = new Date();
  const slot = validateKioskBookedSlot({ now, start, end, timezone: config.appTimezone });
  const created = await createEvents(
    [{
      organizer: employee.email,
      subject: `Room usage - ${employee.name}`,
      description: "Scheduled booking from the kiosk",
      start_date: slot.startDate.toISOString(),
      end_date: slot.endDate.toISOString(),
      attendee_email: room.email,
    }],
    { _id: employee._id, email: employee.email, name: employee.name, role: "USER", floor: employee.floor }
  );
  const first = Array.isArray(created) ? created[0] : null;
  if (first?.id && slot.startsNow) await markCheckedIn(first.id);
  return {
    id: first?.id || null,
    title: first?.title || `Room usage - ${employee.name}`,
    organizer: employee.name,
    start: first?.start || slot.startDate.toISOString(),
    end: first?.end || slot.endDate.toISOString(),
    checkedIn: Boolean(slot.startsNow),
    scheduled: !slot.startsNow,
  };
};

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../../../config/config.js";
import { withTransaction } from "../../db/pool.js";
import { badRequest, conflict, forbidden, HttpError, notFound } from "../../lib/http-error.js";
import { finishEventNow, markCheckedIn } from "../events/event.repository.js";
import { formatLocalTime } from "../events/event-time.js";
import { calendarRange } from "../events/event.service.js";
import { getSettings } from "../settings/setting.repository.js";
import { findActiveKioskRoomById, findKioskEventActionContext, findKioskRoomByLogin, listKioskScheduleRows } from "./kiosk.repository.js";

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

export const authenticateKioskCredentials = async (login, password) => {
  if (!login || !password) throw new HttpError(401, "INVALID_KIOSK_CREDENTIALS", "Invalid room login or password");
  const room = await findKioskRoomByLogin(login);
  const valid = room?.password && await bcrypt.compare(String(password), room.password);
  if (!valid) throw new HttpError(401, "INVALID_KIOSK_CREDENTIALS", "Invalid room login or password");
  return room;
};

export const signKioskToken = (room) => jwt.sign(
  { kind: "kiosk" },
  config.jwtSecret,
  {
    algorithm: "HS256",
    subject: String(room._id),
    expiresIn: config.kioskJwtExpiry,
    issuer: config.jwtIssuer,
    audience: config.kioskJwtAudience,
  }
);

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
  const room = await findActiveKioskRoomById(claims.sub);
  if (!room) throw new HttpError(401, "INACTIVE_KIOSK_ROOM", "Kiosk authentication required");
  return { ...publicKioskRoom(room), kind: "kiosk", roomId: room._id };
};

export const getKioskContext = async (room) => ({
  room: publicKioskRoom(room),
  settings: (await getSettings()) || {},
});

const kioskCapabilities = (row, now = Date.now()) => {
  const start = new Date(row.start_at).getTime();
  const end = new Date(row.end_at).getTime();
  const opens = start - Number(row.early_minutes || 0) * 60_000;
  const closes = start + Number(row.late_minutes || 0) * 60_000;
  return {
    canCheckIn: !row.checked_in && now >= opens && now < closes,
    canFinish: Boolean(row.checked_in) && now >= start && now < end,
  };
};

export const getKioskSchedule = async (query, room) => {
  const range = calendarRange(query.start, query.end, config.appTimezone);
  const rows = await listKioskScheduleRows({ roomId: room._id, ...range });
  return rows.map((row) => ({
    id: row._id,
    title: `[${row.organizer_first_name || "Booked"}, ${formatLocalTime(row.start_at, row.timezone)} - ${formatLocalTime(row.end_at, row.timezone)}]`,
    organizerFirstName: row.organizer_first_name || "Booked",
    start: row.start_at,
    end: row.end_at,
    timezone: row.timezone,
    checkedIn: Boolean(row.checked_in),
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
    const opens = start - Number(context.early_minutes || 0) * 60_000;
    const closes = start + Number(context.late_minutes || 0) * 60_000;
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

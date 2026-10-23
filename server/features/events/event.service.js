import config from "../../../config/config.js";
import { badRequest, conflict, forbidden, HttpError, notFound } from "../../lib/http-error.js";
import { addLocalDays, daysBetweenLocalDates, formatLocalTime, isValidLocalDate, parseInstant, zonedParts, zonedPartsToDate } from "./event-time.js";
import { buildOccurrences } from "./recurrence.service.js";
import {
  cancelEvents,
  cancelSeries,
  clearEventParticipants,
  deactivateEventRooms,
  deleteParticipantById,
  eventCheckInContext,
  eventsForMutationScope,
  findAccountsByEmails,
  findAccountsByIds,
  findActiveRoom,
  findEventAccess,
  findParticipantEvent,
  releaseAbandonedRoomBookings,
  findRoomConflicts,
  findRoomFloors,
  finishEventNow,
  insertEvent,
  insertEventParticipant,
  insertSeries,
  listEventParticipants,
  listEventsForPrincipal,
  markCheckedIn,
  transaction,
  updateEventHeader,
  updateSeriesHeader,
} from "./event.repository.js";

const unique = (values) => [...new Set(values.filter(Boolean).map(String))];
const validScope = (scope) => {
  if (scope == null || scope === "") return "occurrence";
  if (!['occurrence', 'following', 'series'].includes(scope)) throw badRequest("INVALID_SCOPE", "Scope must be occurrence, following, or series");
  return scope;
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateHeader = ({ subject, start, end, timezone }) => {
  const cleanSubject = String(subject || "").trim();
  const startDate = parseInstant(start, "start");
  const endDate = parseInstant(end, "end");
  const durationMs = endDate.getTime() - startDate.getTime();
  if (!cleanSubject) throw badRequest("INVALID_EVENT", "Meeting subject is required");
  if (durationMs <= 0) throw badRequest("INVALID_RANGE", "End time must be after start time");
  if (durationMs > config.maxBookingDurationHours * 3_600_000) {
    throw badRequest("BOOKING_DURATION_LIMIT", `Booking cannot exceed ${config.maxBookingDurationHours} hours`);
  }
  zonedParts(startDate, timezone);
  return { subject: cleanSubject, start: startDate.toISOString(), end: endDate.toISOString(), durationMs };
};

const normalizedCreate = (body) => {
  if (Array.isArray(body)) {
    if (!body.length) throw badRequest("INVALID_EVENT", "Event payload cannot be empty");
    const first = body[0];
    return {
      legacy: true,
      bookingKind: "single",
      subject: first.subject,
      description: first.description || "-",
      start: first.start_date,
      end: first.end_date,
      timezone: first.timezone || config.appTimezone,
      attendeeEmails: unique(body.map((item) => item.attendee_email)),
    };
  }
  return {
    legacy: false,
    bookingKind: body.bookingKind || "single",
    subject: body.subject,
    description: body.description || "-",
    start: body.start || body.start_date,
    end: body.end || body.end_date,
    timezone: body.timezone || config.appTimezone,
    roomIds: unique([body.roomId, ...(body.roomIds || [])]),
    attendeeIds: unique(body.attendeeIds || []),
    visitorEmails: unique(body.visitorEmails || []),
    recurrence: body.recurrence,
  };
};

const participantsFromAccounts = (accounts, visitorEmails = []) => [
  ...accounts.map((account) => account.type === "room"
    ? { email: account.email, roomId: account._id }
    : { email: account.email, userId: account._id }),
  ...visitorEmails.map((email) => ({
    email: String(email).trim().toLowerCase(),
    visitorEmail: String(email).trim().toLowerCase(),
  })),
];

const resolveParticipants = async (request, { requireRoom = true } = {}) => {
  if (request.legacy) {
    const normalizedEmails = request.attendeeEmails.map((email) => String(email).trim().toLowerCase());
    const accounts = await findAccountsByEmails(normalizedEmails);
    const knownEmails = new Set(accounts.map((account) => account.email.toLowerCase()));
    const visitors = normalizedEmails.filter((email) => !knownEmails.has(email));
    const participants = participantsFromAccounts(accounts, visitors);
    if (requireRoom && !participants.some((item) => item.roomId)) throw badRequest("ROOM_REQUIRED", "An active room account is required");
    return participants;
  }
  const accounts = await findAccountsByIds([...request.roomIds, ...request.attendeeIds]);
  const byId = new Map(accounts.map((account) => [String(account._id), account]));
  const rooms = request.roomIds.map((id) => byId.get(id));
  if (!rooms.length || rooms.some((room) => !room || room.type !== "room")) throw badRequest("ROOM_REQUIRED", "Every room must reference an active room account");
  const attendees = request.attendeeIds.map((id) => byId.get(id));
  if (attendees.some((attendee) => !attendee || attendee.type !== "employee")) throw badRequest("INVALID_ATTENDEE", "Every attendee must reference an active employee account");
  return participantsFromAccounts([...rooms, ...attendees], request.visitorEmails.map((email) => String(email).trim().toLowerCase()));
};

const createPlan = async (body) => {
  const request = normalizedCreate(body);
  if (!['single', 'recurring'].includes(request.bookingKind)) {
    throw badRequest("INVALID_BOOKING_KIND", "Booking kind must be single or recurring");
  }
  if (!request.legacy && request.visitorEmails.some((email) => !EMAIL_PATTERN.test(String(email).trim()))) {
    throw badRequest("INVALID_VISITOR", "Every visitor must use a valid email address");
  }
  const header = validateHeader(request);
  const participants = await resolveParticipants(request);
  const occurrencePlan = request.bookingKind === "recurring"
    ? buildOccurrences({ ...request, ...header })
    : { rule: null, occurrences: [{ index: 0, start: header.start, end: header.end }] };
  return { request: { ...request, ...header }, participants, ...occurrencePlan };
};

const roomIdsFor = (participants) => participants.filter((item) => item.roomId).map((item) => item.roomId);


const FLOOR_EXEMPT_ROLES = new Set(["ADMIN"]);
const normalizedFloor = (value) => String(value ?? "").trim();

// Non-admin hanya boleh memesan ruangan di lantai kerjanya sendiri.
const assertRoomFloorAccess = async (roomIds, principal) => {
  if (!config.floorRestriction || !roomIds.length || FLOOR_EXEMPT_ROLES.has(String(principal.role || "").toUpperCase())) return;
  const floor = normalizedFloor(principal.floor);
  if (!floor) {
    throw new HttpError(403, "FLOOR_REQUIRED", "Akun Anda belum memiliki lantai kerja. Minta admin mengisinya di Manajemen > Pengguna.");
  }
  // Grup lantai "all" boleh memesan ruangan di lantai mana pun.
  if (floor.toLowerCase() === "all") return;
  const rooms = await findRoomFloors(roomIds);
  const outside = rooms.filter((room) => normalizedFloor(room.floor) !== floor);
  if (outside.length) {
    const names = outside.map((room) => room.name).join(", ");
    throw new HttpError(403, "FLOOR_RESTRICTED", `Anda hanya dapat memesan ruangan di lantai ${floor}. Ruangan di luar lantai Anda: ${names}.`);
  }
};

export const previewEvents = async (body) => {
  const plan = await createPlan(body);
  const conflicts = await findRoomConflicts(roomIdsFor(plan.participants), plan.occurrences);
  const total = conflicts.length;
  return {
    occurrences: plan.occurrences,
    conflicts: conflicts.slice(0, config.maxPreviewConflicts).map((item) => ({
      roomId: item.room_id,
      start: item.start_at,
      end: item.end_at,
    })),
    conflictTotal: total,
    conflictsTruncated: total > config.maxPreviewConflicts,
  };
};

export const createEvents = async (body, principal) => {
  const plan = await createPlan(body);
  await assertRoomFloorAccess(roomIdsFor(plan.participants), principal);
  try {
    const result = await transaction(async (client) => {
      const series = plan.rule ? await insertSeries(client, {
        organizerId: principal._id,
        subject: plan.request.subject,
        description: plan.request.description,
        timezone: plan.request.timezone,
        cadence: plan.rule.cadence,
        interval: plan.rule.interval,
        weekdays: plan.rule.weekdays,
        endDate: plan.rule.endDate,
      }) : null;
      const rows = [];
      for (const occurrence of plan.occurrences) {
        const event = await insertEvent(client, {
          organizerId: principal._id,
          organizerEmail: principal.email,
          subject: plan.request.subject,
          description: plan.request.description,
          start: occurrence.start,
          end: occurrence.end,
          timezone: plan.request.timezone,
          seriesId: series?._id,
          occurrenceIndex: series ? occurrence.index : null,
        });
        const participants = [];
        for (const participant of plan.participants) {
          participants.push(await insertEventParticipant(client, event._id, participant));
        }
        rows.push({ event, participants });
      }
      return { series, rows };
    });
    if (!plan.request.legacy) {
      return {
        series: result.series,
        occurrences: result.rows.map(({ event }) => ({
          id: event._id,
          start: event.start_at,
          end: event.end_at,
          occurrenceIndex: event.occurrence_index,
        })),
      };
    }
    return result.rows.flatMap(({ event, participants }) => participants.map((participant) => ({
      id: event._id,
      title: event.subject,
      start: event.start_at,
      end: event.end_at,
      organizer: event.organizer,
      event_detail_id: participant._id,
      attendee_email: participant.attendee_email,
      description: event.description,
      is_visitor: participant.is_visitor,
    })));
  } catch (error) {
    if (error.code === "23P01") throw conflict("ROOM_CONFLICT", "A room is already booked during one or more requested occurrences");
    throw error;
  }
};

export const calendarRange = (start, end, timezone) => {
  if (!/^\d{8}$/.test(start || "") || !/^\d{8}$/.test(end || "")) throw badRequest("INVALID_RANGE", "Calendar start and end must use YYYYMMDD");
  const parts = (value) => ({ year: Number(value.slice(0, 4)), month: Number(value.slice(4, 6)), day: Number(value.slice(6, 8)), hour: 0, minute: 0, second: 0 });
  const startParts = parts(start);
  const rawEndParts = parts(end);
  if (!isValidLocalDate(startParts) || !isValidLocalDate(rawEndParts)) throw badRequest("INVALID_RANGE", "Calendar dates are invalid");
  // Batasi rentang supaya satu permintaan tidak menarik puluhan tahun jadwal.
  if (daysBetweenLocalDates(startParts, rawEndParts) + 1 > config.maxCalendarRangeDays) {
    throw badRequest("RANGE_TOO_LARGE", `Calendar range cannot exceed ${config.maxCalendarRangeDays} days`);
  }
  const endParts = addLocalDays(rawEndParts, 1);
  return {
    rangeStart: zonedPartsToDate(startParts, timezone).toISOString(),
    rangeEnd: zonedPartsToDate(endParts, timezone).toISOString(),
  };
};

const projectCalendarEvent = (row) => {
  if (!row.can_view_details) {
    const firstName = row.organizer_first_name || "Booked";
    return {
      id: row._id,
      visibility: "busy",
      title: `[${firstName}, ${formatLocalTime(row.start_at, row.timezone)} - ${formatLocalTime(row.end_at, row.timezone)}]`,
      organizer_first_name: firstName,
      start: row.start_at,
      end: row.end_at,
      timezone: row.timezone,
      can_view_details: false,
    };
  }
  return {
    id: row._id,
    visibility: "full",
    title: row.subject,
    start: row.start_at,
    end: row.end_at,
    organizer: row.organizer,
    description: row.description,
    is_cancel: row.is_cancel,
    is_draft: row.is_draft,
    is_allday: row.is_allday,
    created_at: row.created_at,
    checked_in: row.checked_in,
    late_threshold: row.late_threshold,
    timezone: row.timezone,
    series_id: row.series_id,
    occurrence_index: row.occurrence_index,
    can_view_details: true,
  };
};

export const listEvents = async (queryParams, principal) => {
  const room = queryParams.rooms ? await findActiveRoom(queryParams.rooms) : null;
  if (queryParams.rooms && !room) throw notFound("Room not found");
  const range = calendarRange(queryParams.start, queryParams.end, config.appTimezone);
  const rows = await listEventsForPrincipal({
    principalId: principal._id,
    role: principal.role,
    roomId: room?._id,
    allEvents: queryParams.all === "true" && principal.role === "ADMIN",
    ...range,
  });
  return rows.map(projectCalendarEvent);
};

const canView = (event, principal) => principal.role === "ADMIN" || String(event.organizer_id) === String(principal._id) || event.is_attendee;
const canMutate = (event, principal) => principal.role === "ADMIN" || String(event.organizer_id) === String(principal._id);

export const getEventDetails = async (eventId, principal) => {
  const event = await findEventAccess(eventId, principal._id);
  if (!event) throw notFound("Event not found");
  if (!canView(event, principal)) throw forbidden();
  return listEventParticipants(eventId);
};

const participantShape = (row) => ({
  email: row.attendee_email,
  userId: row.attendee_user_id,
  roomId: row.room_id,
  visitorEmail: row.visitor_email,
});

const localTimeMilliseconds = (parts) => (((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000) + (parts.millisecond || 0);

const shiftLocalParts = (target, pivot, desired) => {
  const dateDelta = daysBetweenLocalDates(pivot, desired);
  const timeDelta = localTimeMilliseconds(desired) - localTimeMilliseconds(pivot);
  const shiftedDate = addLocalDays(target, dateDelta);
  const shifted = new Date(Date.UTC(
    shiftedDate.year,
    shiftedDate.month - 1,
    shiftedDate.day,
    shiftedDate.hour,
    shiftedDate.minute,
    shiftedDate.second,
    shiftedDate.millisecond || 0
  ) + timeDelta);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  };
};

const participantsForUpdate = async (body, eventId) => {
  if (Array.isArray(body.attendees)) {
    const request = {
      legacy: true,
      attendeeEmails: unique(body.attendees.map((item) => item.attendee_email)),
    };
    return resolveParticipants(request);
  }
  return (await listEventParticipants(eventId)).map(participantShape);
};

export const updateEvents = async (body, principal) => {
  const eventId = body.id || body.eventId;
  const access = await findEventAccess(eventId, principal._id);
  if (!access) throw notFound("Event not found");
  if (!canMutate(access, principal)) throw forbidden();
  const scope = validScope(body.scope);
  if (scope !== "occurrence" && !access.series_id) throw badRequest("INVALID_SCOPE", "Series scope requires a recurring event");
  const timezone = body.timezone || access.timezone || config.appTimezone;
  const header = validateHeader({
    subject: body.subject || access.subject,
    start: body.start || body.start_date || access.start_at,
    end: body.end || body.end_date || access.end_at,
    timezone,
  });
  const participants = await participantsForUpdate(body, eventId);
  await assertRoomFloorAccess(participants.filter((participant) => participant.roomId).map((participant) => participant.roomId), principal);
  const pivotLocal = zonedParts(access.start_at, access.timezone);
  const desiredStartLocal = zonedParts(header.start, timezone);
  const desiredEndLocal = zonedParts(header.end, timezone);
  const endDayOffset = daysBetweenLocalDates(desiredStartLocal, desiredEndLocal);
  try {
    return await transaction(async (client) => {
      const targets = await eventsForMutationScope(client, eventId, scope);
      await deactivateEventRooms(client, targets.map((target) => target._id));
      if (scope === "series") {
        await updateSeriesHeader(client, access.series_id, {
          subject: header.subject,
          description: body.description ?? access.description,
          timezone,
        });
      }
      const updated = [];
      for (const target of targets) {
        const localStart = shiftLocalParts(zonedParts(target.start_at, target.timezone), pivotLocal, desiredStartLocal);
        const start = zonedPartsToDate(localStart, timezone);
        const end = zonedPartsToDate({
          ...addLocalDays(localStart, endDayOffset),
          hour: desiredEndLocal.hour,
          minute: desiredEndLocal.minute,
          second: desiredEndLocal.second,
          millisecond: desiredEndLocal.millisecond,
        }, timezone);
        await clearEventParticipants(client, target._id);
        const event = await updateEventHeader(client, target._id, {
          subject: header.subject,
          description: body.description ?? access.description,
          start: start.toISOString(),
          end: end.toISOString(),
          timezone,
          isException: Boolean(target.series_id) && scope !== "series",
        });
        for (const participant of participants) await insertEventParticipant(client, target._id, participant);
        updated.push({
          id: event._id,
          title: event.subject,
          start: event.start_at,
          end: event.end_at,
          organizer: event.organizer,
          description: event.description,
          series_id: event.series_id,
          occurrence_index: event.occurrence_index,
        });
      }
      return updated;
    });
  } catch (error) {
    if (error.code === "23P01") throw conflict("ROOM_CONFLICT", "A room is already booked during the requested update");
    throw error;
  }
};

export const addAttendee = async (body, principal) => {
  const item = Array.isArray(body) ? body[0] : body;
  const eventId = item?.event_id || item?.eventId;
  const access = await findEventAccess(eventId, principal._id);
  if (!access) throw notFound("Event not found");
  if (!canMutate(access, principal)) throw forbidden();
  const participants = await resolveParticipants({ legacy: true, attendeeEmails: [item.attendee_email] }, { requireRoom: false });
  await assertRoomFloorAccess(participants.filter((participant) => participant.roomId).map((participant) => participant.roomId), principal);
  return transaction((client) => insertEventParticipant(client, eventId, participants[0]));
};

export const deleteAttendee = async (detailId, principal) => {
  const event = await findParticipantEvent(detailId);
  if (!event) throw notFound("Attendee not found");
  if (principal.role !== "ADMIN" && String(event.organizer_id) !== String(principal._id)) throw forbidden();
  return transaction(async (client) => {
    const deleted = await deleteParticipantById(client, detailId);
    if (!deleted) throw notFound("Attendee not found");
    return deleted;
  });
};

export const cancelEvent = async (eventId, scope, principal) => {
  const access = await findEventAccess(eventId, principal._id);
  if (!access) throw notFound("Event not found");
  if (!canMutate(access, principal)) throw forbidden();
  const mutationScope = validScope(scope);
  if (mutationScope !== "occurrence" && !access.series_id) throw badRequest("INVALID_SCOPE", "Series scope requires a recurring event");
  return transaction(async (client) => {
    const targets = await eventsForMutationScope(client, eventId, mutationScope);
    if (mutationScope === "series") await cancelSeries(client, access.series_id);
    return cancelEvents(client, targets.map((event) => event._id));
  });
};

export const checkInEvent = async ({ event_id, card_number }, principal) => {
  if (!event_id || !card_number) throw badRequest("INVALID_CHECK_IN", "Event and card number are required");
  const context = await eventCheckInContext(event_id, principal._id, card_number);
  if (!context) throw notFound("Event not found");
  if (principal.role !== "ADMIN" && !context.is_related) throw forbidden();
  if (!context.card_allowed) throw forbidden("Card is not authorized");
  const now = Date.now();
  const opens = new Date(context.start_at).getTime() - Number(context.early_minutes || 0) * 60_000;
  const closes = new Date(context.start_at).getTime() + Number(context.late_minutes || 0) * 60_000;
  if (now < opens || now >= closes) throw new HttpError(409, "CHECK_IN_WINDOW", "Event is outside its check-in window");
  if (context.checked_in) throw conflict("ALREADY_CHECKED_IN", "Event is already checked in");
  return markCheckedIn(event_id);
};

export const earlyFinishEvent = async (eventId, principal) => {
  const access = await findEventAccess(eventId, principal._id);
  if (!access) throw notFound("Event not found");
  if (!canMutate(access, principal)) throw forbidden();
  const now = Date.now();
  if (!access.checked_in || now < new Date(access.start_at).getTime() || now >= new Date(access.end_at).getTime()) {
    throw conflict("EARLY_FINISH_WINDOW", "Only an active checked-in event can be finished early");
  }
  return finishEventNow(eventId);
};

export const releaseAbandonedBookings = async () => releaseAbandonedRoomBookings();

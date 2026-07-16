export const isRoomAttendee = (attendee) =>
  attendee?.type === "room" || Boolean(attendee?.room_id);

export const encodeEventDescription = (value = "") => encodeURIComponent(value);

const asDate = (value) => value instanceof Date ? value : new Date(value);

export const validateEventDraft = (
  { subject, startDate, endDate, attendees = [], bookingKind = "single", recurrence = {} },
  { editing = false, now = new Date() } = {}
) => {
  const start = asDate(startDate);
  const end = asDate(endDate);
  const current = asDate(now);

  if (!String(subject || "").trim()) return "validation.subjectRequired";
  if ([start, end, current].some((date) => Number.isNaN(date.getTime()))) {
    return "validation.invalidTime";
  }
  if (current > end) {
    return editing ? "validation.pastEdit" : "validation.pastCreate";
  }
  if (start >= end) return "validation.endBeforeStart";
  if (!attendees.some(isRoomAttendee)) return "validation.roomRequired";
  if (bookingKind === "recurring") {
    if (!["daily", "weekly"].includes(recurrence.cadence)) return "validation.recurrenceCadence";
    if (!recurrence.endDate) return "validation.recurrenceEnd";
    const endDate = asDate(`${recurrence.endDate}T23:59:59`);
    if (Number.isNaN(endDate.getTime()) || endDate < start) return "validation.recurrenceEnd";
    if (recurrence.cadence === "weekly" && (!Array.isArray(recurrence.weekdays) || !recurrence.weekdays.length)) {
      return "validation.recurrenceWeekday";
    }
  }
  return null;
};

const eventFields = ({ organizer, subject, description, startDate, endDate }) => ({
  organizer,
  subject,
  start_date: asDate(startDate),
  end_date: asDate(endDate),
  description,
});

const attendeeEmail = (attendee) => attendee?.attendee_email || attendee?.email || "";

export const buildModernEventPayload = (draft) => {
  const roomIds = draft.attendees.filter(isRoomAttendee).map((attendee) => attendee.room_id).filter(Boolean);
  const attendeeIds = draft.attendees
    .filter((attendee) => !isRoomAttendee(attendee))
    .map((attendee) => attendee.attendee_user_id || attendee.userId)
    .filter(Boolean);
  const knownIds = new Set(attendeeIds);
  const visitorEmails = draft.attendees
    .filter((attendee) => !isRoomAttendee(attendee) && !(attendee.attendee_user_id || attendee.userId))
    .map(attendeeEmail)
    .filter(Boolean);
  return {
    bookingKind: draft.bookingKind || "single",
    subject: draft.subject,
    description: draft.description,
    start: asDate(draft.startDate),
    end: asDate(draft.endDate),
    timezone: draft.timezone,
    roomIds,
    attendeeIds: [...knownIds],
    visitorEmails,
    ...(draft.bookingKind === "recurring" ? { recurrence: draft.recurrence } : {}),
  };
};

export const buildCreateEventPayload = (draft) =>
  draft.bookingKind === "recurring"
    ? buildModernEventPayload(draft)
    : draft.attendees.map((attendee) => ({
      ...eventFields(draft),
      timezone: draft.timezone,
      attendee_email: attendeeEmail(attendee),
    }));

export const buildUpdateEventPayload = (draft) => ({
  id: draft.id,
  scope: draft.scope,
  timezone: draft.timezone,
  ...eventFields(draft),
  attendees: draft.attendees.map((attendee) => ({ attendee_email: attendeeEmail(attendee) })),
});

export const buildAddAttendeePayload = ({ eventId, attendeeEmail }) => [{
  event_id: eventId,
  attendee_email: attendeeEmail,
}];

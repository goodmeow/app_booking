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
  // A new booking may be scheduled in the future, but it may not start in
  // the past. Editing an existing meeting keeps its historical start intact.
  if (!editing && start < current) return "validation.startInPast";
  if (start >= end) return "validation.endBeforeStart";
  if (!attendees.some(isRoomAttendee)) return "validation.roomRequired";
  // A guest without an account must use an email format; the server rejects with
  // INVALID_VISITOR when the user types a name without a domain.
  const guestEmailInvalid = attendees.some((attendee) => !isRoomAttendee(attendee)
    && !(attendee.attendee_user_id || attendee.userId)
    && !isValidGuestEmail(attendeeEmail(attendee)));
  if (guestEmailInvalid) return "validation.guestEmail";
  if (bookingKind === "recurring") {
    if (!["daily", "weekly", "monthly"].includes(recurrence.cadence)) return "validation.recurrenceCadence";
    if (!recurrence.endDate) return "validation.recurrenceEnd";
    const endDate = asDate(`${recurrence.endDate}T23:59:59`);
    if (Number.isNaN(endDate.getTime()) || endDate < start) return "validation.recurrenceEnd";
    if (recurrence.cadence === "weekly" && (!Array.isArray(recurrence.weekdays) || !recurrence.weekdays.length)) {
      return "validation.recurrenceWeekday";
    }
    if (recurrence.cadence === "monthly") {
      const monthlyPattern = recurrence.monthlyPattern || "date";
      if (!["date", "weekday"].includes(monthlyPattern)) return "validation.recurrenceMonthly";
      if (monthlyPattern === "weekday") {
        if (![1, 2, 3, 4, -1].includes(Number(recurrence.monthWeekIndex))) return "validation.recurrenceMonthly";
        const monthWeekday = Number(recurrence.monthWeekday);
        if (!(monthWeekday >= 0 && monthWeekday <= 6)) return "validation.recurrenceWeekday";
      }
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

const VALID_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidGuestEmail = (email) => VALID_EMAIL_PATTERN.test(String(email).trim());

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

// On-behalf booking: an admin or receptionist names the employee the meeting is
// for. An empty value means the booker organizes the meeting themselves, so the
// field is simply left out. The server only accepts it on create.
export const organizerEmailField = (draft) => {
  const email = String(draft?.organizerEmail ?? "").trim();
  return email ? { organizer_email: email } : {};
};

export const buildCreateEventPayload = (draft) => {
  const onBehalf = Boolean(organizerEmailField(draft).organizer_email);
  // The server reads organizer_email only from the single-object payload; the
  // recovered per-attendee array identifies the organizer as the caller. A
  // front-desk booking for an employee therefore has to use the object shape,
  // otherwise the meeting is stored on the receptionist instead.
  if (draft.bookingKind === "recurring" || onBehalf) {
    return { ...buildModernEventPayload(draft), ...organizerEmailField(draft) };
  }
  return draft.attendees.map((attendee) => ({
    ...eventFields(draft),
    timezone: draft.timezone,
    ...organizerEmailField(draft),
    attendee_email: attendeeEmail(attendee),
  }));
};

export const buildUpdateEventPayload = (draft) => ({
  id: draft.id,
  scope: draft.scope,
  timezone: draft.timezone,
  // `organizer_email` is create-only: an edit must not move the meeting to
  // another employee.
  ...eventFields(draft),
  attendees: draft.attendees.map((attendee) => ({ attendee_email: attendeeEmail(attendee) })),
});

export const buildAddAttendeePayload = ({ eventId, attendeeEmail }) => [{
  event_id: eventId,
  attendee_email: attendeeEmail,
}];

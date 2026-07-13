// Legacy web bundle classifies locations by the broader `@room` marker.
export const isRoomAttendee = (attendee) =>
  attendee?.attendee_email?.toLowerCase().includes("@room") === true;

export const encodeEventDescription = (value = "") => encodeURIComponent(value);

const asDate = (value) => value instanceof Date ? value : new Date(value);

const isSameLocalDay = (left, right) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

export const validateEventDraft = (
  { startDate, endDate, attendees = [] },
  { editing = false, now = new Date() } = {}
) => {
  const start = asDate(startDate);
  const end = asDate(endDate);
  const current = asDate(now);

  if ([start, end, current].some((date) => Number.isNaN(date.getTime()))) {
    return "Waktu mulai dan selesai harus diisi";
  }
  if (current > end) {
    return `Tidak dapat melakukan ${editing ? "perubahan" : "reserve"} meeting (Waktu telah berlalu)`;
  }
  if (start > end) return "Waktu mulai tidak dapat lebih dari waktu selesai";
  if (!isSameLocalDay(start, end)) return "Tidak dapat melakukan reserve meeting (Hari berbeda)";
  if (!attendees.some(isRoomAttendee)) return "Anda harus memilih lokasi ruangan";
  return null;
};

const eventFields = ({ organizer, subject, description, startDate, endDate }) => ({
  organizer,
  subject,
  start_date: asDate(startDate),
  end_date: asDate(endDate),
  description,
});

export const buildCreateEventPayload = (draft) =>
  draft.attendees.map((attendee) => ({
    ...eventFields(draft),
    attendee_email: attendee.attendee_email,
  }));

export const buildUpdateEventPayload = (draft) => ({
  id: draft.id,
  ...eventFields(draft),
  attendees: draft.attendees.map(({ attendee_email }) => ({ attendee_email })),
});

export const buildAddAttendeePayload = ({ eventId, attendeeEmail }) => [{
  event_id: eventId,
  attendee_email: attendeeEmail,
}];

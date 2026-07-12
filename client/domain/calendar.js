const pad = (value) => String(value).padStart(2, "0");

const asDate = (value) => value instanceof Date ? new Date(value) : new Date(value);

export const formatCalendarQueryDate = (value) => {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
};

export const calendarWeekRange = (value) => {
  const selected = asDate(value);
  if (Number.isNaN(selected.getTime())) throw new TypeError("Invalid date");
  const start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - selected.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start: formatCalendarQueryDate(start), end: formatCalendarQueryDate(end) };
};

export const calendarEventFilters = ({ email, roomEmail, range }) => ({
  users: roomEmail ? undefined : email,
  rooms: roomEmail || undefined,
  start: range.start,
  end: range.end,
});

export const defaultEventRange = (value, now = new Date()) => {
  const selected = asDate(value);
  const current = asDate(now);
  const sameDay = selected.toDateString() === current.toDateString();
  const start = sameDay
    ? new Date(current.getFullYear(), current.getMonth(), current.getDate(), current.getHours(), current.getMinutes() < 30 ? 30 : 60, 0, 0)
    : new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 9, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end };
};

export const calendarEventFromApi = (event) => ({
  id: event.id,
  title: event.title,
  start: event.start,
  end: event.end,
  organizer: event.extendedProps?.organizer,
  description: event.extendedProps?.description,
  is_cancel: event.extendedProps?.is_cancel,
  is_draft: event.extendedProps?.is_draft,
  is_allday: event.extendedProps?.is_allday,
  created_at: event.extendedProps?.created_at,
  checked_in: event.extendedProps?.checked_in,
  late_threshold: event.extendedProps?.late_threshold,
});

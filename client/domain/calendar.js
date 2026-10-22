const pad = (value) => String(value).padStart(2, "0");

const asDate = (value) => value instanceof Date ? new Date(value) : new Date(value);

const startOfDay = (value) => {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addDays = (value, amount) => {
  const date = startOfDay(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
};

const startOfWeek = (value) => {
  const selected = startOfDay(value);
  return addDays(selected, -selected.getDay());
};

export const formatCalendarQueryDate = (value) => {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
};

export const calendarWeekRange = (value) => {
  const start = startOfWeek(value);
  const end = addDays(start, 6);
  return { start: formatCalendarQueryDate(start), end: formatCalendarQueryDate(end) };
};

export const calendarDayRange = (value) => {
  const day = startOfDay(value);
  return { start: formatCalendarQueryDate(day), end: formatCalendarQueryDate(day) };
};

export const calendarAgendaRange = (value) => {
  const start = startOfDay(value);
  return { start: formatCalendarQueryDate(start), end: formatCalendarQueryDate(addDays(start, 6)) };
};

export const calendarRangeForView = (value, view) => {
  if (view === "timeGridDay") return calendarDayRange(value);
  if (view === "agenda") return calendarAgendaRange(value);
  return calendarWeekRange(value);
};

export const navigateCalendarDate = (value, view, direction) => {
  const amount = direction === "previous" ? -1 : 1;
  if (view === "timeGridDay") return addDays(value, amount);
  return addDays(value, amount * 7);
};

export const calendarEventFilters = ({ email, roomEmail, range, all = false }) => ({
  users: all || roomEmail ? undefined : email,
  rooms: roomEmail || undefined,
  all: all ? true : undefined,
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

export const formatMeetingTimeRange = (startValue, endValue, locale = "en-GB") => {
  const start = asDate(startValue);
  const end = asDate(endValue);
  if ([start, end].some((date) => Number.isNaN(date.getTime()))) return "";
  const formatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

export const formatMeetingDateCue = (startValue, endValue, locale = "en-GB") => {
  const start = asDate(startValue);
  const end = asDate(endValue);
  if ([start, end].some((date) => Number.isNaN(date.getTime()))) return "";
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
  if (start.toDateString() === end.toDateString()) return dateFormatter.format(start);
  return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
};

export const spansMultipleCalendarDays = (startValue, endValue) => {
  const start = asDate(startValue);
  const end = asDate(endValue);
  if ([start, end].some((date) => Number.isNaN(date.getTime()))) return false;
  return start.toDateString() !== end.toDateString();
};

export const durationMinutes = (startValue, endValue) => {
  const start = asDate(startValue);
  const end = asDate(endValue);
  if ([start, end].some((date) => Number.isNaN(date.getTime())) || end <= start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 60000);
};

const eventValue = (event, name) => event?.[name] ?? event?.extendedProps?.[name];

export const calendarEventCueFlags = (event) => {
  const seriesId = eventValue(event, "series_id");
  const occurrenceIndex = eventValue(event, "occurrence_index");
  const parsedOccurrenceIndex = Number(occurrenceIndex);
  const occurrenceNumber = occurrenceIndex === undefined
    || occurrenceIndex === null
    || occurrenceIndex === ""
    || !Number.isInteger(parsedOccurrenceIndex)
    ? null
    : parsedOccurrenceIndex + 1;
  return {
    multiDay: spansMultipleCalendarDays(event?.start, event?.end),
    recurring: seriesId !== undefined && seriesId !== null && seriesId !== "",
    occurrenceNumber,
  };
};

export const calendarEventFromApi = (event) => ({
  id: event.id,
  title: event.title,
  start: event.start,
  end: event.end,
  organizer: eventValue(event, "organizer"),
  description: eventValue(event, "description"),
  is_cancel: eventValue(event, "is_cancel"),
  is_draft: eventValue(event, "is_draft"),
  is_allday: eventValue(event, "is_allday"),
  created_at: eventValue(event, "created_at"),
  checked_in: eventValue(event, "checked_in"),
  late_threshold: eventValue(event, "late_threshold"),
  ...(eventValue(event, "visibility") === undefined ? {} : { visibility: eventValue(event, "visibility") }),
  ...(eventValue(event, "can_view_details") === undefined ? {} : { can_view_details: eventValue(event, "can_view_details") }),
  ...(eventValue(event, "organizer_first_name") === undefined ? {} : { organizer_first_name: eventValue(event, "organizer_first_name") }),
  ...(eventValue(event, "timezone") === undefined ? {} : { timezone: eventValue(event, "timezone") }),
  ...(eventValue(event, "series_id") === undefined ? {} : { series_id: eventValue(event, "series_id") }),
  ...(eventValue(event, "occurrence_index") === undefined ? {} : { occurrence_index: eventValue(event, "occurrence_index") }),
});

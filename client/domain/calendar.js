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

// 0 = Sunday, 1 = Monday, matching the FullCalendar `firstDay` option. The
// bundled `id` and `en-gb` locales render Monday-first weeks, so the query range
// must start on Monday too; otherwise a Sunday selection is queried one week
// earlier and its meetings never load. Kept as a parameter so a global
// first-day-of-week setting can drive both the calendar and this range later.
export const DEFAULT_WEEK_START_DAY = 1;

export const startOfWeek = (value, weekStartsOn = DEFAULT_WEEK_START_DAY) => {
  const selected = startOfDay(value);
  const daysSinceWeekStart = (selected.getDay() - weekStartsOn + 7) % 7;
  return addDays(selected, -daysSinceWeekStart);
};

export const formatCalendarQueryDate = (value) => {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
};

export const calendarWeekRange = (value, weekStartsOn = DEFAULT_WEEK_START_DAY) => {
  const start = startOfWeek(value, weekStartsOn);
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

export const calendarRangeForView = (value, view, weekStartsOn = DEFAULT_WEEK_START_DAY) => {
  if (view === "timeGridDay") return calendarDayRange(value);
  if (view === "agenda") return calendarAgendaRange(value);
  return calendarWeekRange(value, weekStartsOn);
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

// The floor schedule is assembled from one query per room, so a meeting that
// books several rooms on the same floor arrives more than once.
export const uniqueCalendarEvents = (groups = []) => {
  const seen = new Set();
  const events = [];
  for (const group of groups) {
    for (const event of Array.isArray(group) ? group : []) {
      const key = String(event?.id ?? `${event?.start}-${event?.title}`);
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(event);
    }
  }
  return events;
};

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
  const day = (date) => String(date.getDate()).padStart(2, "0");
  const month = (date) => new Intl.DateTimeFormat(locale, { month: "short" })
    .format(date)
    .replace(/\.$/, "");
  const dateLabel = (date) => `${day(date)}-${month(date)}-${date.getFullYear()}`;
  if (start.toDateString() === end.toDateString()) return dateLabel(start);
  return `${dateLabel(start)} - ${dateLabel(end)}`;
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
  ...(eventValue(event, "can_mutate") === undefined ? {} : { can_mutate: eventValue(event, "can_mutate") }),
  ...(eventValue(event, "organizer_first_name") === undefined ? {} : { organizer_first_name: eventValue(event, "organizer_first_name") }),
  ...(eventValue(event, "timezone") === undefined ? {} : { timezone: eventValue(event, "timezone") }),
  ...(eventValue(event, "series_id") === undefined ? {} : { series_id: eventValue(event, "series_id") }),
  ...(eventValue(event, "occurrence_index") === undefined ? {} : { occurrence_index: eventValue(event, "occurrence_index") }),
  ...(eventValue(event, "booked_by") === undefined ? {} : { booked_by: eventValue(event, "booked_by") }),
  ...(eventValue(event, "booked_by_name") === undefined ? {} : { booked_by_name: eventValue(event, "booked_by_name") }),
});

// A booking created by the front desk belongs to the employee (organizer), but
// the receptionist who placed it must still be able to edit or cancel it.
export const canManageBooking = ({ event, sessionEmail, sessionUserId, isAdmin = false } = {}) => {
  if (isAdmin) return true;
  // The server decides floor-wide receptionist access; the client must not
  // re-derive it from event data that does not include room floors.
  const serverCanMutate = eventValue(event, "can_mutate");
  if (serverCanMutate !== undefined) return Boolean(serverCanMutate);
  const organizer = String(eventValue(event, "organizer") ?? "").trim().toLowerCase();
  const ownEmail = String(sessionEmail ?? "").trim().toLowerCase();
  if (organizer && ownEmail && organizer === ownEmail) return true;
  const bookedBy = String(eventValue(event, "booked_by") ?? "").trim();
  const ownId = String(sessionUserId ?? "").trim();
  return Boolean(bookedBy && ownId && bookedBy === ownId);
};

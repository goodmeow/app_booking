import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarAgendaRange,
  calendarDayRange,
  calendarEventCueFlags,
  calendarEventFilters,
  calendarEventFromApi,
  calendarRangeForView,
  calendarWeekRange,
  canManageBooking,
  defaultEventRange,
  durationMinutes,
  formatCalendarQueryDate,
  formatMeetingDateCue,
  formatMeetingTimeRange,
  navigateCalendarDate,
  spansMultipleCalendarDays,
  uniqueCalendarEvents,
} from "../domain/calendar.js";

test("builds a Monday-first event query range that matches the calendar grid", () => {
  assert.deepEqual(calendarWeekRange(new Date(2030, 0, 16)), { start: "20300114", end: "20300120" });
  assert.equal(formatCalendarQueryDate(new Date(2030, 0, 5)), "20300105");
});

test("keeps Sunday inside the selected week instead of shifting a week back", () => {
  // 2030-01-20 is a Sunday: the week must stay 14-20 Jan and still include it.
  const sunday = new Date(2030, 0, 20, 10, 30);
  assert.deepEqual(calendarWeekRange(sunday), { start: "20300114", end: "20300120" });
  assert.equal(formatCalendarQueryDate(sunday) >= "20300114" && formatCalendarQueryDate(sunday) <= "20300120", true);
  // A Sunday that starts a week (2030-01-13) keeps its own seven days.
  assert.deepEqual(calendarWeekRange(new Date(2030, 0, 13)), { start: "20300107", end: "20300113" });
  assert.deepEqual(calendarRangeForView(sunday, "timeGridWeek"), { start: "20300114", end: "20300120" });
});

test("accepts any configured first day of the week", () => {
  const wednesday = new Date(2030, 0, 16);
  assert.deepEqual(calendarWeekRange(wednesday, 0), { start: "20300113", end: "20300119" });
  assert.deepEqual(calendarWeekRange(wednesday, 1), { start: "20300114", end: "20300120" });
  assert.deepEqual(calendarWeekRange(wednesday, 6), { start: "20300112", end: "20300118" });
  assert.deepEqual(calendarRangeForView(wednesday, "timeGridWeek", 0), { start: "20300113", end: "20300119" });
});

test("merges one query per room without duplicating a multi-room meeting", () => {
  const event = { id: "event-1", title: "Planning", start: "2030-01-15T09:00:00.000Z" };
  const other = { id: "event-2", title: "Review", start: "2030-01-16T09:00:00.000Z" };
  assert.deepEqual(uniqueCalendarEvents([[event], [event, other], undefined]), [event, other]);
  assert.deepEqual(uniqueCalendarEvents([]), []);
});

test("builds Day, Week, and Agenda ranges for controlled calendar views", () => {
  const selected = new Date(2030, 0, 16);
  assert.deepEqual(calendarDayRange(selected), { start: "20300116", end: "20300116" });
  assert.deepEqual(calendarAgendaRange(selected), { start: "20300116", end: "20300122" });
  assert.deepEqual(calendarRangeForView(selected, "timeGridDay"), { start: "20300116", end: "20300116" });
  assert.deepEqual(calendarRangeForView(selected, "agenda"), { start: "20300116", end: "20300122" });
  assert.equal(navigateCalendarDate(selected, "timeGridDay", "next").getDate(), 17);
  assert.equal(navigateCalendarDate(selected, "timeGridWeek", "previous").getDate(), 9);
});

test("formats meeting time, date cue, and duration for visible calendar labels", () => {
  const start = new Date("2030-01-15T09:00:00");
  const end = new Date("2030-01-16T10:30:00");
  assert.equal(formatMeetingTimeRange(start, end, "en-GB"), "09:00 - 10:30");
  assert.match(formatMeetingDateCue(start, end, "en-GB"), /15-Jan-2030 - 16-Jan-2030/);
  assert.equal(spansMultipleCalendarDays(start, end), true);
  assert.equal(durationMinutes(start, end), 1530);
});

test("builds calendar cue flags for multi-day and recurring events", () => {
  assert.deepEqual(
    calendarEventCueFlags({
      start: new Date(2030, 0, 15, 23, 0),
      end: new Date(2030, 0, 16, 1, 0),
      series_id: "series-1",
      occurrence_index: 2,
    }),
    { multiDay: true, recurring: true, occurrenceNumber: 3 }
  );
  assert.deepEqual(
    calendarEventCueFlags({
      start: "2030-01-15T09:00:00.000Z",
      end: "2030-01-15T10:00:00.000Z",
    }),
    { multiDay: false, recurring: false, occurrenceNumber: null }
  );
  assert.deepEqual(
    calendarEventCueFlags({
      start: new Date(2030, 0, 15, 9, 0),
      end: new Date(2030, 0, 15, 10, 0),
      series_id: "series-1",
      occurrence_index: null,
    }),
    { multiDay: false, recurring: true, occurrenceNumber: null }
  );
});

test("builds a thirty-minute default event range", () => {
  const future = defaultEventRange(new Date(2030, 0, 16), new Date(2030, 0, 15, 8, 10));
  assert.equal(future.start.getHours(), 9);
  assert.equal(future.end.getTime() - future.start.getTime(), 30 * 60 * 1000);
});

test("repairs the legacy room filter by avoiding the conflicting user predicate", () => {
  const range = { start: "20300113", end: "20300119" };
  // Node compares properties with undefined values differently across
  // versions; compare only the properties that are actually set.
  const defined = (filters) => Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined)
  );
  assert.deepEqual(
    defined(calendarEventFilters({ email: "user@example.test", roomEmail: null, range })),
    { users: "user@example.test", ...range }
  );
  assert.deepEqual(
    defined(calendarEventFilters({ email: "user@example.test", roomEmail: "meeting@room.com", range })),
    { rooms: "meeting@room.com", ...range }
  );
});

test("maps FullCalendar event API to recovered editor header", () => {
  assert.deepEqual(
    calendarEventFromApi({
      id: "event-1",
      title: "Planning",
      start: new Date("2030-01-15T09:00:00"),
      end: new Date("2030-01-15T10:00:00"),
      extendedProps: { organizer: "owner@example.test", description: "Quarterly" },
    }),
    {
      id: "event-1",
      title: "Planning",
      start: new Date("2030-01-15T09:00:00"),
      end: new Date("2030-01-15T10:00:00"),
      organizer: "owner@example.test",
      description: "Quarterly",
      is_cancel: undefined,
      is_draft: undefined,
      is_allday: undefined,
      created_at: undefined,
      checked_in: undefined,
      late_threshold: undefined,
    }
  );
});

test("maps plain API event objects from Agenda clicks", () => {
  assert.equal(
    calendarEventFromApi({
      id: "event-1",
      title: "Planning",
      start: "2030-01-15T09:00:00.000Z",
      end: "2030-01-15T10:00:00.000Z",
      organizer: "owner@example.test",
      can_view_details: true,
      series_id: "series-1",
    }).series_id,
    "series-1"
  );
});

test("carries the on-behalf booker only when the server sends it", () => {
  const mapped = calendarEventFromApi({
    id: "event-1",
    title: "Planning",
    start: "2030-01-15T09:00:00.000Z",
    end: "2030-01-15T10:00:00.000Z",
    organizer: "budi@contoh.id",
    booked_by: "user-receptionist",
    booked_by_name: "Rina",
  });
  assert.equal(mapped.booked_by, "user-receptionist");
  assert.equal(mapped.booked_by_name, "Rina");
  // A self booking (booked_by null) keeps the old shape, so no empty
  // "Booked by" row renders.
  const own = calendarEventFromApi({ id: "event-2", title: "Own", booked_by: null });
  assert.equal(Object.hasOwn(own, "booked_by"), false);
  assert.equal(Object.hasOwn(own, "booked_by_name"), false);
});

test("lets the organizer and the receptionist who booked manage a meeting", () => {
  const session = { sessionEmail: "Rina@Contoh.id", sessionUserId: "u-receptionist" };
  assert.equal(
    canManageBooking({ event: { organizer: "budi@contoh.id" }, ...session }),
    false
  );
  assert.equal(
    canManageBooking({ event: { organizer: "budi@contoh.id", booked_by: "u-receptionist" }, ...session }),
    true
  );
  assert.equal(
    canManageBooking({ event: { organizer: "rina@contoh.id" }, ...session }),
    true
  );
  assert.equal(
    canManageBooking({ event: { organizer: "budi@contoh.id", booked_by: "u-other" }, ...session }),
    false
  );
  assert.equal(
    canManageBooking({ event: { organizer: "budi@contoh.id" }, ...session, isAdmin: true }),
    true
  );
  assert.equal(canManageBooking(), false);
});

test("uses the server can_mutate flag for floor-wide receptionist access", () => {
  const session = { sessionEmail: "rina@contoh.id", sessionUserId: "u-receptionist" };
  assert.equal(
    canManageBooking({ event: { organizer: "budi@contoh.id", can_mutate: true }, ...session }),
    true
  );
  assert.equal(
    canManageBooking({ event: { organizer: "rina@contoh.id", can_mutate: false }, ...session }),
    false
  );
  assert.equal(calendarEventFromApi({ id: "event-3", can_mutate: true }).can_mutate, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarAgendaRange,
  calendarDayRange,
  calendarEventFilters,
  calendarEventFromApi,
  calendarRangeForView,
  calendarWeekRange,
  defaultEventRange,
  durationMinutes,
  formatCalendarQueryDate,
  formatMeetingDateCue,
  formatMeetingTimeRange,
  navigateCalendarDate,
} from "../domain/calendar.js";

test("builds recovered Sunday-to-Saturday event query range", () => {
  assert.deepEqual(calendarWeekRange(new Date(2030, 0, 16)), { start: "20300113", end: "20300119" });
  assert.equal(formatCalendarQueryDate(new Date(2030, 0, 5)), "20300105");
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
  assert.match(formatMeetingDateCue(start, end, "en-GB"), /15 Jan 2030 - 16 Jan 2030/);
  assert.equal(durationMinutes(start, end), 1530);
});

test("builds a thirty-minute default event range", () => {
  const future = defaultEventRange(new Date(2030, 0, 16), new Date(2030, 0, 15, 8, 10));
  assert.equal(future.start.getHours(), 9);
  assert.equal(future.end.getTime() - future.start.getTime(), 30 * 60 * 1000);
});

test("repairs the legacy room filter by avoiding the conflicting user predicate", () => {
  const range = { start: "20300113", end: "20300119" };
  assert.deepEqual(
    calendarEventFilters({ email: "user@example.test", roomEmail: null, range }),
    { users: "user@example.test", rooms: undefined, ...range }
  );
  assert.deepEqual(
    calendarEventFilters({ email: "user@example.test", roomEmail: "meeting@room.com", range }),
    { users: undefined, rooms: "meeting@room.com", ...range }
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

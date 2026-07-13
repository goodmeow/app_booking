import assert from "node:assert/strict";
import test from "node:test";
import { calendarEventFilters, calendarEventFromApi, calendarWeekRange, defaultEventRange, formatCalendarQueryDate } from "../domain/calendar.js";

test("builds recovered Sunday-to-Saturday event query range", () => {
  assert.deepEqual(calendarWeekRange(new Date(2030, 0, 16)), { start: "20300113", end: "20300119" });
  assert.equal(formatCalendarQueryDate(new Date(2030, 0, 5)), "20300105");
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

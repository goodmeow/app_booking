import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOccurrences } from "../../features/events/recurrence.service.js";

const wibMorning = (date, hour = 2) => `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;

test("monthly on a fixed date repeats every month including months with 30 days", () => {
  const result = buildOccurrences({
    start: wibMorning("2030-01-15"),
    end: wibMorning("2030-01-15", 3),
    timezone: "Asia/Jakarta",
    recurrence: { cadence: "monthly", interval: 1, endDate: "2030-03-20" },
  });
  assert.deepEqual(result.occurrences.map((item) => item.localDate), [
    "2030-01-15",
    "2030-02-15",
    "2030-03-15",
  ]);
});

test("monthly interval 2 lands every other month", () => {
  const result = buildOccurrences({
    start: wibMorning("2030-01-15"),
    end: wibMorning("2030-01-15", 3),
    timezone: "Asia/Jakarta",
    recurrence: { cadence: "monthly", interval: 2, endDate: "2030-07-20" },
  });
  assert.deepEqual(result.occurrences.map((item) => item.localDate), [
    "2030-01-15",
    "2030-03-15",
    "2030-05-15",
    "2030-07-15",
  ]);
});

test("monthly on day 31 skips months without the date", () => {
  const result = buildOccurrences({
    start: wibMorning("2030-01-31"),
    end: wibMorning("2030-01-31", 3),
    timezone: "Asia/Jakarta",
    recurrence: { cadence: "monthly", interval: 1, endDate: "2030-05-31" },
  });
  assert.deepEqual(result.occurrences.map((item) => item.localDate), [
    "2030-01-31",
    "2030-03-31",
    "2030-05-31",
  ]);
});

test("monthly second Monday follows the weekday position", () => {
  const result = buildOccurrences({
    start: wibMorning("2030-01-14"),
    end: wibMorning("2030-01-14", 3),
    timezone: "Asia/Jakarta",
    recurrence: {
      cadence: "monthly",
      interval: 1,
      monthlyPattern: "weekday",
      monthWeekIndex: 2,
      monthWeekday: 1,
      endDate: "2030-03-20",
    },
  });
  assert.deepEqual(result.occurrences.map((item) => item.localDate), [
    "2030-01-14",
    "2030-02-11",
    "2030-03-11",
  ]);
});

test("monthly last Friday matches months where the Friday count differs", () => {
  const result = buildOccurrences({
    start: wibMorning("2030-01-25"),
    end: wibMorning("2030-01-25", 3),
    timezone: "Asia/Jakarta",
    recurrence: {
      cadence: "monthly",
      interval: 1,
      monthlyPattern: "weekday",
      monthWeekIndex: -1,
      monthWeekday: 5,
      endDate: "2030-03-31",
    },
  });
  assert.deepEqual(result.occurrences.map((item) => item.localDate), [
    "2030-01-25",
    "2030-02-22",
    "2030-03-29",
  ]);
});

test("monthly rejects an unknown pattern and bad weekday index", () => {
  assert.throws(() => buildOccurrences({
    start: wibMorning("2030-01-15"),
    end: wibMorning("2030-01-15", 3),
    timezone: "Asia/Jakarta",
    recurrence: { cadence: "monthly", interval: 1, monthlyPattern: "yearly", endDate: "2030-02-15" },
  }), (error) => error.code === "INVALID_RECURRENCE");
  assert.throws(() => buildOccurrences({
    start: wibMorning("2030-01-14"),
    end: wibMorning("2030-01-14", 3),
    timezone: "Asia/Jakarta",
    recurrence: {
      cadence: "monthly",
      interval: 1,
      monthlyPattern: "weekday",
      monthWeekIndex: 5,
      monthWeekday: 1,
      endDate: "2030-02-14",
    },
  }), (error) => error.code === "INVALID_RECURRENCE");
});

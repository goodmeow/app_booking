import assert from "node:assert/strict";
import { test } from "node:test";
import { validateKioskBookedSlot } from "../../features/kiosk/kiosk.service.js";

// Zona server Asia/Jakarta: 10:00 WIB = 03:00 UTC.
const timezone = "Asia/Jakarta";
const now = new Date("2032-03-10T03:00:00.000Z");

test("a valid slot for today is accepted and marked as starting now", () => {
  const slot = validateKioskBookedSlot({
    now,
    start: "2032-03-10T03:01:00.000Z",
    end: "2032-03-10T04:01:00.000Z",
    timezone,
  });
  assert.equal(slot.startDate.toISOString(), "2032-03-10T03:01:00.000Z");
  assert.equal(slot.endDate.toISOString(), "2032-03-10T04:01:00.000Z");
  assert.equal(slot.startsNow, true);
});

test("a slot that starts later is not checked in right away", () => {
  const slot = validateKioskBookedSlot({
    now,
    start: "2032-03-10T09:00:00.000Z", // 16:00 WIB, still the same day
    end: "2032-03-10T10:00:00.000Z",
    timezone,
  });
  assert.equal(slot.startsNow, false);
});

test("rejects a start time that is already in the past", () => {
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T02:30:00.000Z",
      end: "2032-03-10T03:30:00.000Z",
      timezone,
    }),
    /already in the past/,
  );
});

test("rejects a slot that crosses the end of the day in the server time zone", () => {
  // 23:30 WIB to 00:30 WIB the next day.
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T16:30:00.000Z",
      end: "2032-03-10T17:30:00.000Z",
      timezone,
    }),
    /for today only/,
  );
});

test("rejects a duration under 5 minutes or over 4 hours", () => {
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T04:00:00.000Z",
      end: "2032-03-10T04:03:00.000Z",
      timezone,
    }),
    /5-240 minutes/,
  );
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T04:00:00.000Z",
      end: "2032-03-10T09:00:00.000Z",
      timezone,
    }),
    /5-240 minutes/,
  );
});

test("rejects an invalid time", () => {
  assert.throws(
    () => validateKioskBookedSlot({ now, start: "not-a-date", end: "2032-03-10T04:00:00.000Z", timezone }),
    /are required/,
  );
});

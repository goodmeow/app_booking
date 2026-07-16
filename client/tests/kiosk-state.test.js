import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveKioskState, formatKioskDate, kioskDayRange } from "../kiosk/kiosk-state.js";

const meeting = (start, end, values = {}) => ({ id: "event-1", start, end, checkedIn: false, canCheckIn: false, ...values });
const now = new Date("2031-05-10T02:00:00.000Z");

test("kiosk day query is bound to one local calendar day", () => {
  assert.deepEqual(kioskDayRange(new Date(2031, 4, 10, 9)), { start: "20310510", end: "20310510" });
});

test("kiosk date follows the selected language", () => {
  const date = new Date(2031, 4, 10, 9);
  assert.match(formatKioskDate(date, "en"), /May/);
  assert.match(formatKioskDate(date, "id"), /Mei/);
});

test("kiosk derives available and upcoming states before a meeting", () => {
  assert.equal(deriveKioskState([], {}, now).mode, "available");
  assert.equal(deriveKioskState([
    meeting("2031-05-10T02:30:00.000Z", "2031-05-10T03:00:00.000Z"),
  ], { time_of_event_start_soon: 10 }, now).mode, "upcoming");
  assert.equal(deriveKioskState([
    meeting("2031-05-10T02:05:00.000Z", "2031-05-10T03:00:00.000Z"),
  ], {}, now).mode, "upcoming");
});

test("kiosk uses half-open current-meeting boundaries", () => {
  const active = meeting("2031-05-10T01:30:00.000Z", "2031-05-10T02:30:00.000Z", { checkedIn: true });
  assert.equal(deriveKioskState([active], {}, now).mode, "occupied");
  assert.equal(deriveKioskState([active], {}, new Date(active.end)).mode, "available");
});

test("current and overnight meetings are occupied without check-in", () => {
  const unchecked = meeting("2031-05-10T01:30:00.000Z", "2031-05-10T02:30:00.000Z");
  assert.equal(deriveKioskState([unchecked], {}, now).mode, "occupied");
  const overnight = meeting("2031-05-09T16:00:00.000Z", "2031-05-10T03:00:00.000Z", { checkedIn: true });
  assert.equal(deriveKioskState([overnight], {}, now).mode, "occupied");
});

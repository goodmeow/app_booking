import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveKioskState, formatKioskDate, kioskDayRange, kioskLedCodeFor } from "../kiosk/kiosk-state.js";

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

test("a room without an active meeting stays available, including shortly before the next one", () => {
  assert.equal(deriveKioskState([], {}, now).mode, "available");
  assert.equal(deriveKioskState([
    meeting("2031-05-10T02:05:00.000Z", "2031-05-10T03:00:00.000Z"),
  ], {}, now).mode, "available");
  const before = deriveKioskState([
    meeting("2031-05-10T02:30:00.000Z", "2031-05-10T03:00:00.000Z"),
  ], {}, now);
  assert.equal(before.mode, "available");
  assert.equal(before.next.id, "event-1");
});

test("an active meeting is yellow until it is checked in, then red", () => {
  const unchecked = meeting("2031-05-10T01:30:00.000Z", "2031-05-10T02:30:00.000Z");
  assert.equal(deriveKioskState([unchecked], {}, now).mode, "awaitingCheckIn");
  const checked = { ...unchecked, checkedIn: true };
  assert.equal(deriveKioskState([checked], {}, now).mode, "occupied");
});

test("current-meeting boundaries are half-open", () => {
  const active = meeting("2031-05-10T01:30:00.000Z", "2031-05-10T02:30:00.000Z", { checkedIn: true });
  assert.equal(deriveKioskState([active], {}, now).mode, "occupied");
  assert.equal(deriveKioskState([active], {}, new Date(active.end)).mode, "available");
});

test("overnight meetings keep the traffic-light state until they end", () => {
  const overnight = meeting("2031-05-09T16:00:00.000Z", "2031-05-10T03:00:00.000Z");
  assert.equal(deriveKioskState([overnight], {}, now).mode, "awaitingCheckIn");
  assert.equal(deriveKioskState([{ ...overnight, checkedIn: true }], {}, now).mode, "occupied");
});

test("a stale schedule reports offline instead of a false available", () => {
  const active = meeting("2031-05-10T01:30:00.000Z", "2031-05-10T02:30:00.000Z");
  const offline = deriveKioskState([active], {}, now, { fresh: false });
  assert.equal(offline.mode, "offline");
  assert.equal(offline.current, null);
});

test("malformed rows are ignored", () => {
  assert.equal(deriveKioskState([
    meeting("not-a-date", "also-not"),
  ], {}, now).mode, "available");
});

test("LED codes match the verified tablet traffic light", () => {
  assert.equal(kioskLedCodeFor("available"), 5);
  assert.equal(kioskLedCodeFor("awaitingCheckIn"), 20);
  assert.equal(kioskLedCodeFor("occupied"), 4);
  assert.equal(kioskLedCodeFor("offline"), 2);
  assert.equal(kioskLedCodeFor("unknown"), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { instantBookingWindow } from "../../features/kiosk/kiosk.service.js";

const timezone = "Asia/Jakarta";

test("a 30-minute instant booking ends on the same day", () => {
  const now = new Date("2031-05-09T16:50:00.000Z"); // 23:50 Jakarta
  const window = instantBookingWindow({ now, minutes: 30, timezone });
  assert.equal(window.end.toISOString(), "2031-05-09T16:59:59.000Z"); // 23:59:59 Jakarta
  assert.equal(window.untilNext, false);
});

test("a next meeting tomorrow does not extend the instant booking past midnight", () => {
  const now = new Date("2031-05-09T16:50:00.000Z");
  const window = instantBookingWindow({
    now,
    nextStart: "2031-05-09T17:30:00.000Z", // 00:30 Jakarta, the next day
    minutes: 30,
    timezone,
  });
  assert.equal(window.untilNext, false);
  assert.equal(window.end.toISOString(), "2031-05-09T16:59:59.000Z");
});

test("a next meeting on the same day is still used as the limit", () => {
  const now = new Date("2031-05-09T10:00:00.000Z"); // 17:00 Jakarta
  const next = "2031-05-09T11:00:00.000Z"; // 18:00 Jakarta
  const window = instantBookingWindow({ now, nextStart: next, minutes: 240, timezone });
  assert.equal(window.untilNext, true);
  assert.equal(window.end.toISOString(), next);
});

test("duration is clamped to a minimum of 5 and a maximum of 240 minutes", () => {
  const now = new Date("2031-05-09T03:00:00.000Z"); // 10:00 Jakarta
  assert.equal(
    instantBookingWindow({ now, minutes: 1, timezone }).end.toISOString(),
    "2031-05-09T03:05:00.000Z"
  );
  assert.equal(
    instantBookingWindow({ now, minutes: 999, timezone }).end.toISOString(),
    "2031-05-09T07:00:00.000Z"
  );
});

test("a remaining time under one minute is detectable by the caller", () => {
  const now = new Date("2031-05-09T16:59:30.000Z"); // 23:59:30 Jakarta
  const window = instantBookingWindow({ now, minutes: 30, timezone });
  assert.ok(window.end.getTime() - now.getTime() < 60_000);
});

test("the requested duration is respected even when the next meeting is far away", () => {
  const now = new Date("2031-05-09T03:00:00.000Z"); // 10:00 Jakarta
  const window = instantBookingWindow({ now, nextStart: "2031-05-09T10:00:00.000Z", minutes: 30, timezone });
  assert.equal(window.end.toISOString(), "2031-05-09T03:30:00.000Z");
  assert.equal(window.untilNext, false);
});

test("the next meeting cuts off a duration that runs past it", () => {
  const now = new Date("2031-05-09T03:00:00.000Z");
  const next = "2031-05-09T03:20:00.000Z";
  const window = instantBookingWindow({ now, nextStart: next, minutes: 60, timezone });
  assert.equal(window.end.toISOString(), next);
  assert.equal(window.untilNext, true);
});

test("until_next uses the next meeting as the end", () => {
  const now = new Date("2031-05-09T03:00:00.000Z");
  const next = "2031-05-09T06:00:00.000Z";
  const window = instantBookingWindow({ now, nextStart: next, minutes: 30, untilNext: true, timezone });
  assert.equal(window.end.toISOString(), next);
  assert.equal(window.untilNext, true);
});

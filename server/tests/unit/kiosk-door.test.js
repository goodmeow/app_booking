import assert from "node:assert/strict";
import { test } from "node:test";
import { activeDoorMeeting } from "../../features/kiosk/kiosk.service.js";

// A meeting covers the door from its check-in window (start minus early
// minutes) until its end. Outside that window the room is free.
const meeting = (start, end, earlyMinutes = 10, cardAllowed = true) => ({
  _id: "event",
  start_at: start,
  end_at: end,
  early_minutes: earlyMinutes,
  card_allowed: cardAllowed,
});

test("an active meeting owns the door for its whole window", () => {
  const row = meeting("2026-11-04T10:00:00+07:00", "2026-11-04T11:00:00+07:00");
  assert.equal(activeDoorMeeting([row], Date.parse("2026-11-04T09:51:00+07:00"))?.card_allowed, true);
  assert.equal(activeDoorMeeting([row], Date.parse("2026-11-04T10:30:00+07:00"))?.card_allowed, true);
});

test("before the check-in window and after the end the room counts as free", () => {
  const row = meeting("2026-11-04T10:00:00+07:00", "2026-11-04T11:00:00+07:00");
  assert.equal(activeDoorMeeting([row], Date.parse("2026-11-04T09:49:00+07:00")), null);
  assert.equal(activeDoorMeeting([row], Date.parse("2026-11-04T11:00:00+07:00")), null);
});

test("the first meeting covering now wins when several are listed", () => {
  const past = meeting("2026-11-04T08:00:00+07:00", "2026-11-04T09:00:00+07:00");
  const current = meeting("2026-11-04T10:00:00+07:00", "2026-11-04T11:00:00+07:00");
  const next = meeting("2026-11-04T13:00:00+07:00", "2026-11-04T14:00:00+07:00");
  const found = activeDoorMeeting([past, current, next], Date.parse("2026-11-04T10:05:00+07:00"));
  assert.equal(found?._id, current._id);
});

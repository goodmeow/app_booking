import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";
import { zonedParts, zonedPartsToDate } from "../../features/events/event-time.js";

// End-to-end coverage for POST /api/kiosk/events/book: the kiosk "pick a
// time" flow (choose start and end times for today, paid with a card).

const SERVER_TIMEZONE = "Asia/Jakarta";
const MIDNIGHT_SAFETY_MINUTES = 20;

// Minutes from now until 23:59 in the server timezone; when this runs near
// midnight the "free slot today" scenarios simply cannot exist, so they are
// skipped instead of failing.
const minutesLeftToday = () => {
  const parts = zonedParts(new Date(), SERVER_TIMEZONE);
  const minutesOfDay = parts.hour * 60 + parts.minute;
  return 23 * 60 + 59 - minutesOfDay;
};

const slotSkipReason = minutesLeftToday() < MIDNIGHT_SAFETY_MINUTES + 10
  ? "not enough time left today for a valid slot (test near midnight)"
  : false;

// The shared free slot for the create/overlap pair; fixed once so the
// overlap test reuses the exact same instants. It starts well after the
// "within two minutes" scenario, so the two do not overlap.
const SLOT_START_MINUTES = 70;
const SLOT_DURATION_MINUTES = Math.max(5, Math.min(30, minutesLeftToday() - MIDNIGHT_SAFETY_MINUTES - SLOT_START_MINUTES));
const slotFrom = (minutes) => fromNow(minutes);
const slotStart = slotFrom(SLOT_START_MINUTES);
const slotEnd = fromNow(SLOT_START_MINUTES + SLOT_DURATION_MINUTES);

function fromNow(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

let server;
let kioskToken;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  kioskToken = (await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identities.room.email, password: "RoomTablet123!", deviceName: "Booking Test Tablet" }),
  })).body.token;
});

after(async () => stopServer(server));

const book = (body) => apiRequest(targets.reconstructed, "/api/kiosk/events/book", {
  method: "POST",
  headers: { Authorization: `Bearer ${kioskToken}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("kiosk slot booking requires a registered employee card", async () => {
  const unknown = await book({ card_number: "UNKNOWN-CARD", start: slotStart, end: slotEnd });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.code, "INVALID_CARD");

  const missing = await book({ start: slotStart, end: slotEnd });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, "INVALID_CARD");
});

test("a valid free slot is created as scheduled, then the same slot conflicts", { skip: slotSkipReason }, async () => {
  assert.ok(SLOT_DURATION_MINUTES >= 5);
  const created = await book({ card_number: "TEST-USER-CARD", start: slotStart, end: slotEnd });
  assert.equal(created.status, 200);
  assert.equal(created.body.scheduled, true);
  assert.equal(created.body.checkedIn, false);
  assert.match(created.body.title, /Test User/);

  // The exact same instants must now be rejected by the room exclusion constraint.
  const overlap = await book({ card_number: "TEST-USER-CARD", start: slotStart, end: slotEnd });
  assert.equal(overlap.status, 409);
  assert.equal(overlap.body.code, "ROOM_CONFLICT");
});

test("slots must not start in the past", async () => {
  const response = await book({ card_number: "TEST-USER-CARD", start: fromNow(-60), end: fromNow(60) });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_TIME");
});

test("duration is clamped between 5 and 240 minutes", async () => {
  const short = await book({ card_number: "TEST-USER-CARD", start: fromNow(30), end: fromNow(31) });
  assert.equal(short.status, 400);
  assert.equal(short.body.code, "INVALID_TIME");

  const long = await book({ card_number: "TEST-USER-CARD", start: fromNow(30), end: fromNow(400) });
  assert.equal(long.status, 400);
  assert.equal(long.body.code, "INVALID_TIME");
});

test("a slot that crosses midnight into tomorrow is rejected", { skip: minutesLeftToday() < 20 }, async () => {
  // 23:30 Asia/Jakarta today -> 00:30 Asia/Jakarta next day.
  const start = zonedPartsToDate({ ...zonedParts(new Date(), SERVER_TIMEZONE), hour: 23, minute: 30 }, SERVER_TIMEZONE);
  const end = new Date(start.getTime() + 60 * 60_000);
  const response = await book({ card_number: "TEST-USER-CARD", start: start.toISOString(), end: end.toISOString() });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_TIME");
});

test("a booking that starts within two minutes is checked in immediately", { skip: minutesLeftToday() < 40 }, async () => {
  // Reserve the short window right now: it ends before SLOT_START_MINUTES,
  // so it cannot overlap the shared free slot used by the other cases.
  const start = new Date(Math.ceil((Date.now() + 20_000) / 60_000) * 60_000);
  const end = new Date(start.getTime() + 10 * 60_000);
  assert.ok(
    end.getTime() <= Date.now() + SLOT_START_MINUTES * 60_000,
    "the immediate window would overlap the shared slot",
  );
  const response = await book({ card_number: "TEST-USER-CARD", start: start.toISOString(), end: end.toISOString() });
  assert.equal(response.status, 200);
  assert.equal(response.body.checkedIn, true);
  assert.equal(response.body.scheduled, false);
});

test("cards from other floors are restricted", async () => {
  const created = await apiRequest(targets.reconstructed, "/api/users", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({ name: "Floor Two Employee", email: "floor.two@example.test", password: "Password123!", floor: "2", roleId: "67e9500b-908a-497d-9d3b-54bc020700cb" }),
  });
  assert.equal(created.status, 201);

  const unregistered = await book({ card_number: "FLOOR-TWO-CARD", start: slotStart, end: slotEnd });
  assert.equal(unregistered.status, 400);
  assert.equal(unregistered.body.code, "INVALID_CARD");

  const lookup = await apiRequest(targets.reconstructed, "/api/users?email=floor.two@example.test", {
    headers: bearer("admin"),
  });
  const targetId = Array.isArray(lookup.body) ? lookup.body[0]?._id : lookup.body?._id;
  assert.ok(targetId);

  const withCard = await apiRequest(targets.reconstructed, `/api/users/${targetId}`, {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ card_number: "FLOOR-TWO-CARD" }),
  });
  assert.ok([200, 201].includes(withCard.status));

  const restricted = await book({ card_number: "FLOOR-TWO-CARD", start: slotStart, end: slotEnd });
  assert.equal(restricted.status, 403);
  assert.equal(restricted.body.code, "FLOOR_RESTRICTED");
});

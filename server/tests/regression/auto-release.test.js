import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer } from "../parity/fixtures.js";

let server;
let kioskToken;

const startOfToday = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
};

const createMeeting = (roomEmail, subject) => apiRequest(targets.reconstructed, "/api/events", {
  method: "POST",
  headers: bearer("admin"),
  body: JSON.stringify([{
    organizer: "admin@example.test",
    subject,
    start_date: new Date(Date.now() - 20 * 60_000).toISOString(),
    end_date: new Date(Date.now() + 20 * 60_000).toISOString(),
    attendee_email: roomEmail,
  }]),
});

const kioskSchedule = () => apiRequest(
  targets.reconstructed,
  `/api/kiosk/schedule?start=${startOfToday()}&end=${startOfToday()}`,
  { headers: { Authorization: `Bearer ${kioskToken}` } }
);

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  const kiosk = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "room-one@room.com", password: "RoomTablet123!", deviceName: "Auto Release Test" }),
  });
  assert.equal(kiosk.status, 200);
  kioskToken = kiosk.body.token;
});

after(() => stopServer(server));

test("a meeting that is already checked in is not released", async () => {
  const created = await createMeeting("room-two@room.com", "Meeting hadir");
  assert.equal(created.status, 200);
  await queryParityDatabase(`UPDATE tbl_events SET checked_in = now() WHERE _id = '${created.body[0].id}';`);

  const schedule = await kioskSchedule();
  assert.equal(schedule.status, 200);

  const active = await queryParityDatabase(
    `SELECT active FROM tbl_event_rooms WHERE event_id = '${created.body[0].id}';`
  );
  assert.equal(active, "t");
});

test("a no-show meeting is released and the room can be used again", async () => {
  const created = await createMeeting("room-one@room.com", "Meeting no show");
  assert.equal(created.status, 200);

  const schedule = await kioskSchedule();
  assert.equal(schedule.status, 200);
  assert.equal(schedule.body.some((event) => event.id === created.body[0].id), false);

  const active = await queryParityDatabase(
    `SELECT active FROM tbl_event_rooms WHERE event_id = '${created.body[0].id}';`
  );
  assert.equal(active, "f");

  const instant = await apiRequest(targets.reconstructed, "/api/kiosk/events/instant", {
    method: "POST",
    headers: { Authorization: `Bearer ${kioskToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ card_number: "TEST-USER-CARD", minutes: 30 }),
  });
  assert.equal(instant.status, 200);
});

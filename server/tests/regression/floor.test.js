import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

let server;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
});

after(() => stopServer(server));

const meetingBody = (roomEmail, start = "2031-06-02T09:00:00.000Z", end = "2031-06-02T10:00:00.000Z") => JSON.stringify([{
  organizer: identities.user.email,
  subject: "Floor limit test",
  description: "uji",
  start_date: start,
  end_date: end,
  attendee_email: roomEmail,
}]);

test("an employee may only book rooms on their own work floor", async () => {
  // room-one is on floor 1, room-two on floor 2; the test employee is on floor 1.
  const outside = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("user"),
    body: meetingBody("room-two@room.com"),
  });
  assert.equal(outside.status, 403);
  assert.equal(outside.body.code, "FLOOR_RESTRICTED");

  const ownFloor = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("user"),
    body: meetingBody("room-one@room.com"),
  });
  assert.equal(ownFloor.status, 200);
});

test("an admin may still book rooms across floors", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("admin"),
    body: meetingBody("room-two@room.com"),
  });
  assert.equal(response.status, 200);
});

test("the floor group all may cross floors and only an admin can change it", async () => {
  const ownChange = await apiRequest(targets.reconstructed, `/api/users/${identities.user._id}`, {
    method: "PUT",
    headers: bearer("user"),
    body: JSON.stringify({ floor: "all" }),
  });
  assert.equal(ownChange.status, 200);
  assert.equal(ownChange.body.floor, "1");

  const adminChange = await apiRequest(targets.reconstructed, `/api/users/${identities.user._id}`, {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ floor: "all" }),
  });
  assert.equal(adminChange.status, 200);
  assert.equal(adminChange.body.floor, "all");

  try {
    const anyFloor = await apiRequest(targets.reconstructed, "/api/events", {
      method: "POST",
      headers: bearer("user"),
      body: meetingBody("room-two@room.com", "2031-06-02T11:00:00.000Z", "2031-06-02T12:00:00.000Z"),
    });
    assert.equal(anyFloor.status, 200);
  } finally {
    await apiRequest(targets.reconstructed, `/api/users/${identities.user._id}`, {
      method: "PUT",
      headers: bearer("admin"),
      body: JSON.stringify({ floor: "1" }),
    });
  }
});

test("the kiosk rejects an instant booking when the card is not from the room's floor", async () => {
  const kiosk = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "room-two@room.com", password: "RoomTablet123!", deviceName: "Floor 2 Tablet" }),
  });
  assert.equal(kiosk.status, 200);

  const instant = await apiRequest(targets.reconstructed, "/api/kiosk/events/instant", {
    method: "POST",
    headers: { Authorization: `Bearer ${kiosk.body.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ card_number: "TEST-USER-CARD", minutes: 30 }),
  });
  assert.equal(instant.status, 403);
  assert.equal(instant.body.code, "FLOOR_RESTRICTED");
});

test("preview also rejects a room outside the caller's floor", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events/preview", {
    method: "POST",
    headers: bearer("user"),
    body: meetingBody("room-two@room.com", "2031-06-02T13:00:00.000Z", "2031-06-02T14:00:00.000Z"),
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FLOOR_RESTRICTED");
});

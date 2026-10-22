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

const meetingBody = (roomEmail) => JSON.stringify([{
  organizer: identities.user.email,
  subject: "Uji batas lantai",
  description: "uji",
  start_date: "2031-06-02T09:00:00.000Z",
  end_date: "2031-06-02T10:00:00.000Z",
  attendee_email: roomEmail,
}]);

test("karyawan hanya boleh memesan ruangan di lantai kerjanya", async () => {
  // room-one ada di lantai 1, room-two di lantai 2; karyawan uji di lantai 1.
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

test("admin tetap boleh memesan ruangan lintas lantai", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("admin"),
    body: meetingBody("room-two@room.com"),
  });
  assert.equal(response.status, 200);
});

test("kiosk menolak pemesanan cepat bila kartu bukan dari lantai ruangan", async () => {
  const kiosk = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "room-two@room.com", password: "RoomTablet123!", deviceName: "Tablet Lantai 2" }),
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

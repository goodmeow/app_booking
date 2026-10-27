import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

// Demo values only: dummy accounts created by the test itself.
const RECEPTIONIST_EMAIL = "frontdesk.floor2@example.test";
const RECEPTIONIST_PASSWORD = "Resepsionis123!";

const roomTwoId = "30000000-0000-4000-8000-000000000002";
const roomThreeId = "30000000-0000-4000-8000-000000000003";

let server;
let receptionistId;
let receptionistToken;
let floorTwoToken;

const receptionistBearer = () => ({
  Authorization: `Bearer ${receptionistToken}`,
  "Content-Type": "application/json",
});

const floorTwoBearer = () => ({
  Authorization: `Bearer ${floorTwoToken}`,
  "Content-Type": "application/json",
});

const bookingBody = ({ roomId, organizerEmail, start, end, subject = "Rapat lantai dua" }) => JSON.stringify({
  subject,
  description: "Dipesan resepsionis untuk karyawan",
  start,
  end,
  timezone: "Asia/Jakarta",
  roomIds: [roomId],
  ...(organizerEmail ? { organizer_email: organizerEmail } : {}),
});

const calendarEvents = async (date) => {
  const response = await apiRequest(
    targets.reconstructed,
    `/api/events?start=${date}&end=${date}`,
    { headers: bearer("user") }
  );
  assert.equal(response.status, 200);
  return response.body;
};

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);

  const receptionistRoleId = await queryParityDatabase(
    "SELECT _id FROM tbl_role WHERE lower(role_name) = 'receptionist';"
  );
  assert.match(receptionistRoleId, /^[0-9a-f-]{36}$/);

  const created = await apiRequest(targets.reconstructed, "/api/users/", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      name: "Front Desk Floor Two",
      email: RECEPTIONIST_EMAIL,
      username: "frontdesk-floor2",
      employee_id: "EMP-FRONTDESK-2",
      password: RECEPTIONIST_PASSWORD,
      floor: "2",
      roleId: receptionistRoleId,
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.floor, "2");
  receptionistId = created.body._id;

  const signin = await apiRequest(targets.reconstructed, "/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: RECEPTIONIST_EMAIL, password: RECEPTIONIST_PASSWORD }),
  });
  assert.equal(signin.status, 200);
  assert.equal(signin.body.user.role, "RECEPTIONIST");
  receptionistToken = signin.body.token;

  const userRoleId = await queryParityDatabase(
    "SELECT _id FROM tbl_role WHERE lower(role_name) = 'user';"
  );
  const floorUser = await apiRequest(targets.reconstructed, "/api/users/", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      name: "Floor Two Employee",
      email: "employee.floor2@example.test",
      username: "employee-floor2",
      employee_id: "EMP-FLOOR2",
      password: RECEPTIONIST_PASSWORD,
      floor: "2",
      roleId: userRoleId,
    }),
  });
  assert.equal(floorUser.status, 201);

  const floorSignin = await apiRequest(targets.reconstructed, "/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "employee.floor2@example.test", password: RECEPTIONIST_PASSWORD }),
  });
  assert.equal(floorSignin.status, 200);
  floorTwoToken = floorSignin.body.token;
});

after(() => stopServer(server));

test("a receptionist books a room on their floor for an employee from another floor", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: receptionistBearer(),
    body: bookingBody({
      roomId: roomTwoId,
      organizerEmail: "  User@Example.Test  ",
      start: "2031-07-01T01:00:00.000Z",
      end: "2031-07-01T02:00:00.000Z",
    }),
  });
  // The reconstructed API answers every event creation with 200, not 201.
  assert.equal(response.status, 200);
  assert.equal(response.body.occurrences.length, 1);
  const eventId = response.body.occurrences[0].id;

  const stored = await queryParityDatabase(
    `SELECT
       u.email || '|' ||
       coalesce(e.booked_by::text, 'null') || '|' ||
       coalesce(b.email, 'null')
     FROM tbl_events e
     JOIN tbl_users u ON u._id = e.organizer_id
     LEFT JOIN tbl_users b ON b._id = e.booked_by
     WHERE e._id = '${eventId}';`
  );
  assert.equal(stored, `${identities.user.email}|${receptionistId}|${RECEPTIONIST_EMAIL}`);

  // The booking belongs to the employee, so it shows up in their own calendar
  // together with the account that made it.
  const events = await calendarEvents("20310701");
  const booking = events.find((event) => event.id === eventId);
  assert.ok(booking, "the employee calendar must contain the booking made for them");
  assert.equal(booking.visibility, "full");
  assert.equal(booking.organizer, identities.user.email);
  assert.equal(booking.booked_by, receptionistId);
  assert.equal(booking.booked_by_name, "Front Desk Floor Two");

  // The receptionist also sees it, because booked_by grants visibility.
  const receptionistList = await apiRequest(
    targets.reconstructed,
    "/api/events?start=20310701&end=20310701",
    { headers: receptionistBearer() }
  );
  assert.equal(receptionistList.status, 200);
  assert.ok(receptionistList.body.some((event) => event.id === eventId));
});

test("a self booking carries no booked_by and no booked_by_name", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("user"),
    body: bookingBody({
      roomId: "30000000-0000-4000-8000-000000000001",
      start: "2031-07-02T01:00:00.000Z",
      end: "2031-07-02T02:00:00.000Z",
    }),
  });
  assert.equal(response.status, 200);

  const events = await calendarEvents("20310702");
  const booking = events.find((event) => event.id === response.body.occurrences[0].id);
  assert.ok(booking);
  assert.equal(booking.booked_by, null);
  assert.equal(booking.booked_by_name, null);
});

test("a receptionist may only book rooms on their own floor", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: receptionistBearer(),
    body: bookingBody({
      roomId: roomThreeId,
      organizerEmail: identities.user.email,
      start: "2031-07-03T01:00:00.000Z",
      end: "2031-07-03T02:00:00.000Z",
    }),
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FLOOR_RESTRICTED");
});

test("a receptionist edits the booking they created, an unrelated user cannot", async () => {
  const created = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: receptionistBearer(),
    body: bookingBody({
      roomId: roomTwoId,
      organizerEmail: identities.user.email,
      start: "2031-07-04T01:00:00.000Z",
      end: "2031-07-04T02:00:00.000Z",
    }),
  });
  assert.equal(created.status, 200);
  const eventId = created.body.occurrences[0].id;

  const updated = await apiRequest(targets.reconstructed, "/api/events", {
    method: "PUT",
    headers: receptionistBearer(),
    body: JSON.stringify({ id: eventId, subject: "Rapat lantai dua (diubah)" }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body[0].title, "Rapat lantai dua (diubah)");
  // The organizer must not move to the receptionist that edited the booking.
  assert.equal(updated.body[0].organizer, identities.user.email);

  const outsider = await apiRequest(targets.reconstructed, "/api/events", {
    method: "PUT",
    headers: bearer("viewer"),
    body: JSON.stringify({ id: eventId, subject: "Bukan hak saya" }),
  });
  assert.equal(outsider.status, 403);
  assert.equal(outsider.body.code, "FORBIDDEN");

  const details = await apiRequest(
    targets.reconstructed,
    `/api/events/details?event_id=${eventId}`,
    { headers: bearer("viewer") }
  );
  assert.equal(details.status, 403);
});

test("an unknown organizer email is rejected with INVALID_ORGANIZER", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: receptionistBearer(),
    body: bookingBody({
      roomId: roomTwoId,
      organizerEmail: "nobody.here@example.test",
      start: "2031-07-05T01:00:00.000Z",
      end: "2031-07-05T02:00:00.000Z",
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_ORGANIZER");
});

test("a plain employee cannot name another organizer", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("viewer"),
    body: bookingBody({
      roomId: "30000000-0000-4000-8000-000000000001",
      organizerEmail: identities.user.email,
      start: "2031-07-06T01:00:00.000Z",
      end: "2031-07-06T02:00:00.000Z",
    }),
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FORBIDDEN");
});

test("a receptionist may cancel an employee self-booking on their floor", async () => {
  const created = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: floorTwoBearer(),
    body: bookingBody({
      roomId: roomTwoId,
      start: "2031-07-07T01:00:00.000Z",
      end: "2031-07-07T02:00:00.000Z",
      subject: "Rapat mandiri lantai dua",
    }),
  });
  assert.equal(created.status, 200);
  const eventId = created.body.occurrences[0].id;

  const list = await apiRequest(
    targets.reconstructed,
    "/api/events?start=20310707&end=20310707",
    { headers: receptionistBearer() }
  );
  assert.equal(list.status, 200);
  const booking = list.body.find((event) => event.id === eventId);
  assert.ok(booking, "the receptionist must see the floor booking");
  assert.equal(booking.can_mutate, true);

  const canceled = await apiRequest(
    targets.reconstructed,
    `/api/events/${eventId}?scope=occurrence`,
    { method: "DELETE", headers: receptionistBearer() }
  );
  assert.equal(canceled.status, 200);

  const after = await apiRequest(
    targets.reconstructed,
    "/api/events?start=20310707&end=20310707",
    { headers: receptionistBearer() }
  );
  assert.equal(after.status, 200);
  assert.equal(after.body.some((event) => event.id === eventId), false);
});

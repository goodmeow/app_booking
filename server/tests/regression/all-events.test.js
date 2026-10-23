import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

let server;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);

  const employeeMeeting = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("user"),
    body: JSON.stringify([{
      organizer: identities.user.email,
      subject: "Rapat karyawan",
      start_date: "2031-07-01T09:00:00.000Z",
      end_date: "2031-07-01T10:00:00.000Z",
      attendee_email: "room-one@room.com",
    }]),
  });
  assert.equal(employeeMeeting.status, 200);

  const adminMeeting = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify([{
      organizer: identities.admin.email,
      subject: "Rapat admin",
      start_date: "2031-07-01T11:00:00.000Z",
      end_date: "2031-07-01T12:00:00.000Z",
      attendee_email: "room-two@room.com",
    }]),
  });
  assert.equal(adminMeeting.status, 200);
});

after(() => stopServer(server));

const listEvents = (query, token) => apiRequest(
  targets.reconstructed,
  `/api/events?start=20310701&end=20310701${query}`,
  { headers: bearer(token) }
);

test("an admin sees every employee's schedule through all=true", async () => {
  const all = await listEvents("&all=true", "admin");
  assert.equal(all.status, 200);
  const titles = all.body.map((event) => event.title);
  assert.ok(titles.includes("Rapat karyawan"));
  assert.ok(titles.includes("Rapat admin"));
});

test("an admin without all=true still sees only their own schedule", async () => {
  const own = await listEvents("", "admin");
  assert.equal(own.status, 200);
  const titles = own.body.map((event) => event.title);
  assert.ok(titles.includes("Rapat admin"));
  assert.equal(titles.includes("Rapat karyawan"), false);
});

test("a regular user cannot use all=true to see other people's schedules", async () => {
  const attempted = await listEvents("&all=true", "user");
  assert.equal(attempted.status, 200);
  const titles = attempted.body.map((event) => event.title);
  assert.ok(titles.includes("Rapat karyawan"));
  assert.equal(titles.includes("Rapat admin"), false);
});

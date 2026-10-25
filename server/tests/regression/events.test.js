import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, ids, identities } from "../parity/fixtures.js";

let server;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
});

after(async () => {
  await stopServer(server);
});

test("room-filtered calendar returns room bookings", async () => {
  const response = await apiRequest(
    targets.reconstructed,
    "/api/events?rooms=room-one%40room.com&start=20300101&end=20300131",
    { headers: bearer("admin") }
  );
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.some((event) => event.id === ids.event));
});

test("event creation accepts an empty description", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify([
      {
        organizer: identities.admin.email,
        subject: "Empty description regression",
        description: "",
        start_date: "2031-01-15T10:00:00.000Z",
        end_date: "2031-01-15T10:30:00.000Z",
        attendee_email: identities.admin.email,
      },
      {
        organizer: identities.admin.email,
        subject: "Empty description regression",
        description: "",
        start_date: "2031-01-15T10:00:00.000Z",
        end_date: "2031-01-15T10:30:00.000Z",
        attendee_email: identities.room.email,
      },
    ]),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.ok(response.body.every((row) => row.description === "-"));
});

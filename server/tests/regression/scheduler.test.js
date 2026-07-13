import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

let server;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
});

after(async () => stopServer(server));

const legacyPayload = ({ subject, start, end, room = identities.room.email }) => [
  { organizer: identities.admin.email, subject, description: "", start_date: start, end_date: end, attendee_email: identities.admin.email },
  { organizer: identities.admin.email, subject, description: "", start_date: start, end_date: end, attendee_email: room },
];

const createLegacy = (payload) => apiRequest(targets.reconstructed, "/api/events", {
  method: "POST",
  headers: bearer("admin"),
  body: JSON.stringify(payload),
});

test("continuous multi-day booking is stored and visible across week boundaries", async () => {
  const created = await createLegacy(legacyPayload({
    subject: "Cross-week booking",
    room: "room-two@room.com",
    start: "2031-01-04T02:00:00.000Z",
    end: "2031-01-07T03:00:00.000Z",
  }));
  assert.equal(created.status, 200);
  const eventId = created.body[0].id;
  for (const [start, end] of [["20301229", "20310104"], ["20310105", "20310111"]]) {
    const listed = await apiRequest(
      targets.reconstructed,
      `/api/events?rooms=room-two%40room.com&start=${start}&end=${end}`,
      { headers: bearer("admin") }
    );
    assert.equal(listed.status, 200);
    assert.ok(listed.body.some((event) => event.id === eventId));
  }
});

test("half-open room exclusion rejects containing overlap and permits adjacency", async () => {
  const overlap = await createLegacy(legacyPayload({
    subject: "Contained conflict",
    start: "2030-01-15T03:15:00.000Z",
    end: "2030-01-15T03:30:00.000Z",
  }));
  assert.equal(overlap.status, 409);
  assert.equal(overlap.body.code, "ROOM_CONFLICT");

  const adjacent = await createLegacy(legacyPayload({
    subject: "Adjacent meeting",
    start: "2030-01-15T04:00:00.000Z",
    end: "2030-01-15T04:30:00.000Z",
  }));
  assert.equal(adjacent.status, 200);
});

test("concurrent requests cannot double-book one room", async () => {
  const payload = legacyPayload({
    subject: "Concurrent booking",
    room: "room-three@room.com",
    start: "2031-03-01T02:00:00.000Z",
    end: "2031-03-01T03:00:00.000Z",
  });
  const responses = await Promise.all([createLegacy(payload), createLegacy(payload)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
});

test("recurring meetings materialize through inclusive end date", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      bookingKind: "recurring",
      subject: "Daily standup",
      description: "Recurring",
      roomId: "30000000-0000-4000-8000-000000000002",
      attendeeIds: [identities.user._id],
      start: "2031-04-01T02:00:00.000Z",
      end: "2031-04-01T02:30:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence: { cadence: "daily", interval: 1, endDate: "2031-04-03" },
    }),
  });
  assert.equal(response.status, 200);
  assert.ok(response.body.series._id);
  assert.equal(response.body.occurrences.length, 3);
  assert.equal(
    await queryParityDatabase(`SELECT count(*) FROM tbl_events WHERE series_id='${response.body.series._id}';`),
    "3"
  );
});

test("one conflicting occurrence rolls back the entire recurring series", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      bookingKind: "recurring",
      subject: "Atomic recurrence",
      roomId: identities.room._id,
      start: "2030-01-14T03:00:00.000Z",
      end: "2030-01-14T04:00:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence: { cadence: "daily", interval: 1, endDate: "2030-01-16" },
    }),
  });
  assert.equal(response.status, 409);
  assert.equal(await queryParityDatabase("SELECT count(*) FROM tbl_events WHERE subject='Atomic recurrence';"), "0");
  assert.equal(await queryParityDatabase("SELECT count(*) FROM tbl_event_series WHERE subject='Atomic recurrence';"), "0");
});

test("following and series scopes mutate deterministic materialized occurrences", async () => {
  const created = await apiRequest(targets.reconstructed, "/api/events", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      bookingKind: "recurring",
      subject: "Scoped recurrence",
      roomId: "30000000-0000-4000-8000-000000000003",
      start: "2031-05-10T02:00:00.000Z",
      end: "2031-05-10T02:30:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence: { cadence: "daily", interval: 1, endDate: "2031-05-12" },
    }),
  });
  assert.equal(created.status, 200);
  const [first, second] = created.body.occurrences;

  const invalid = await apiRequest(targets.reconstructed, "/api/events", {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ eventId: second.id, scope: "future-ish", subject: "Wrong", start: second.start, end: second.end }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, "INVALID_SCOPE");

  const shifted = await apiRequest(targets.reconstructed, "/api/events", {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({
      eventId: second.id,
      scope: "following",
      subject: "Shifted recurrence",
      start: "2031-05-12T02:00:00.000Z",
      end: "2031-05-12T02:30:00.000Z",
      timezone: "Asia/Jakarta",
    }),
  });
  assert.equal(shifted.status, 200);
  assert.equal(shifted.body.length, 2);
  assert.deepEqual(shifted.body.map((item) => item.start), ["2031-05-12T02:00:00.000Z", "2031-05-13T02:00:00.000Z"]);
  assert.equal(await queryParityDatabase(`SELECT subject FROM tbl_events WHERE _id='${first.id}';`), "Scoped recurrence");

  const canceled = await apiRequest(targets.reconstructed, `/api/events/${first.id}?scope=series`, {
    method: "DELETE",
    headers: bearer("admin"),
  });
  assert.equal(canceled.status, 200);
  assert.equal(await queryParityDatabase(`SELECT count(*) FROM tbl_events WHERE series_id='${created.body.series._id}' AND is_cancel;`), "3");
  assert.equal(await queryParityDatabase(`SELECT is_cancel FROM tbl_event_series WHERE _id='${created.body.series._id}';`), "t");
});

test("room usage clips multi-day duration to report boundaries", async () => {
  const created = await createLegacy(legacyPayload({
    subject: "Clipped report booking",
    room: "room-three@room.com",
    start: "2031-04-30T17:00:00.000Z",
    end: "2031-05-01T17:00:00.000Z",
  }));
  assert.equal(created.status, 200);
  const report = await apiRequest(targets.reconstructed, "/api/rooms/usage-report?start=2031-05-01&end=2031-05-01", {
    headers: bearer("admin"),
  });
  assert.equal(report.status, 200);
  const room = report.body.find((item) => item.room_mail === "room-three@room.com");
  assert.equal(room.total_pemakaian, "1 day");
  assert.ok(room.list_meeting.some((meeting) => meeting.id === created.body[0].id));
});

test("room availability uses the same containing-overlap rule", async () => {
  const response = await apiRequest(
    targets.reconstructed,
    "/api/rooms/available?start_dates=2030-01-15T03%3A15%3A00.000Z&end_dates=2030-01-15T03%3A30%3A00.000Z",
    { headers: bearer("user") }
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.some((room) => room._id === identities.room._id), false);
});

test("room availability rejects timestamps without an explicit offset", async () => {
  const response = await apiRequest(
    targets.reconstructed,
    "/api/rooms/available?start_dates=2031-01-01T09%3A00%3A00&end_dates=2031-01-01T10%3A00%3A00",
    { headers: bearer("user") }
  );
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_TIME");
});

test("check-in and early-finish enforce relation and active windows", async () => {
  const now = Date.now();
  const created = await createLegacy(legacyPayload({
    subject: "Active check-in",
    room: "room-three@room.com",
    start: new Date(now - 60_000).toISOString(),
    end: new Date(now + 30 * 60_000).toISOString(),
  }));
  assert.equal(created.status, 200);
  const eventId = created.body[0].id;
  const checked = await apiRequest(targets.reconstructed, "/api/events/check-in", {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ event_id: eventId, card_number: "TEST-MASTER-CARD" }),
  });
  assert.equal(checked.status, 200);
  const finished = await apiRequest(targets.reconstructed, "/api/events/early-finish", {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ event_id: eventId }),
  });
  assert.equal(finished.status, 200);
});

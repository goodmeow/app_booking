import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

let server;
let kioskToken;
let kioskRefreshToken;
let kioskDevice;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
});

after(async () => stopServer(server));

const kioskHeaders = () => ({ Authorization: `Bearer ${kioskToken}`, "Content-Type": "application/json" });

const createMeeting = async ({ room, subject, start, end }) => apiRequest(targets.reconstructed, "/api/events", {
  method: "POST",
  headers: bearer("admin"),
  body: JSON.stringify([
    { organizer: identities.admin.email, subject, description: "private", start_date: start, end_date: end, attendee_email: identities.admin.email },
    { organizer: identities.admin.email, subject, description: "private", start_date: start, end_date: end, attendee_email: room },
  ]),
});

test("room credentials create an isolated kiosk session", async () => {
  const invalid = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identities.room.email, password: "wrong-password" }),
  });
  assert.equal(invalid.status, 401);

  const authenticated = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identities.room.email, password: "RoomTablet123!", deviceName: "Room One Test Tablet" }),
  });
  assert.equal(authenticated.status, 200);
  assert.ok(authenticated.body.token);
  assert.ok(authenticated.body.refreshToken);
  assert.equal(authenticated.body.device.name, "Room One Test Tablet");
  assert.equal(authenticated.body.room._id, identities.room._id);
  assert.equal(Object.hasOwn(authenticated.body.room, "password"), false);
  kioskToken = authenticated.body.token;
  kioskRefreshToken = authenticated.body.refreshToken;
  kioskDevice = authenticated.body.device;

  const employeeToken = await apiRequest(targets.reconstructed, "/api/kiosk/context", { headers: bearer("admin") });
  assert.equal(employeeToken.status, 401);
  const webEndpoint = await apiRequest(targets.reconstructed, "/api/events?start=20300101&end=20300131", { headers: kioskHeaders() });
  assert.equal(webEndpoint.status, 401);
});

test("kiosk door accepts master and employee cards but not unknown cards", async () => {
  const attempt = (card_number) => apiRequest(targets.reconstructed, "/api/kiosk/door-open", {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify({ card_number }),
  });

  const master = await attempt("TEST-MASTER-CARD");
  assert.equal(master.status, 200);
  assert.equal(master.body.message, "Door opened");

  const employee = await attempt("TEST-USER-CARD");
  assert.equal(employee.status, 200);

  const unknown = await attempt("UNKNOWN-CARD");
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.code, "INVALID_CARD");

  const missing = await apiRequest(targets.reconstructed, "/api/kiosk/door-open", {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify({}),
  });
  assert.equal(missing.status, 400);

  const employeeSession = await apiRequest(targets.reconstructed, "/api/kiosk/door-open", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({ card_number: "TEST-MASTER-CARD" }),
  });
  assert.equal(employeeSession.status, 401);
});

test("kiosk refresh tolerates one lost response then rejects replay", async () => {
  const previousToken = kioskToken;
  const previousRefresh = kioskRefreshToken;
  const refreshPrevious = () => apiRequest(targets.reconstructed, "/api/kiosk/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: previousRefresh }),
  });
  const [refreshed, concurrentRetry] = await Promise.all([refreshPrevious(), refreshPrevious()]);
  assert.equal(refreshed.status, 200);
  assert.equal(concurrentRetry.status, 200);
  assert.equal(concurrentRetry.body.refreshToken, refreshed.body.refreshToken);
  assert.notEqual(refreshed.body.token, previousToken);
  assert.notEqual(refreshed.body.refreshToken, previousRefresh);
  kioskToken = refreshed.body.token;
  kioskRefreshToken = refreshed.body.refreshToken;

  const staleAccess = await apiRequest(targets.reconstructed, "/api/kiosk/context", {
    headers: { Authorization: `Bearer ${previousToken}` },
  });
  assert.equal(staleAccess.status, 401);
  const retry = await refreshPrevious();
  assert.equal(retry.status, 200);
  assert.equal(retry.body.refreshToken, kioskRefreshToken);
  kioskToken = retry.body.token;
  kioskRefreshToken = retry.body.refreshToken;

  const advanced = await apiRequest(targets.reconstructed, "/api/kiosk/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: kioskRefreshToken }),
  });
  assert.equal(advanced.status, 200);
  kioskToken = advanced.body.token;
  kioskRefreshToken = advanced.body.refreshToken;

  const replay = await apiRequest(targets.reconstructed, "/api/kiosk/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: previousRefresh }),
  });
  assert.equal(replay.status, 401);
});

test("administrators manage capabilities and revoke individual kiosk devices", async () => {
  const denied = await apiRequest(targets.reconstructed, "/api/kiosk/devices", { headers: bearer("user") });
  assert.equal(denied.status, 403);
  const listed = await apiRequest(targets.reconstructed, "/api/kiosk/devices", { headers: bearer("admin") });
  assert.equal(listed.status, 200);
  const current = listed.body.find((device) => device.id === kioskDevice.id);
  assert.equal(current.status, "active");
  assert.equal(current.nfcEnabled, false);
  assert.equal(current.ledEnabled, false);
  assert.equal(Object.hasOwn(current, "refreshTokenHash"), false);

  const capabilityDenied = await apiRequest(
    targets.reconstructed,
    `/api/kiosk/devices/${kioskDevice.id}/capabilities`,
    {
      method: "PATCH",
      headers: bearer("user"),
      body: JSON.stringify({ nfcEnabled: true }),
    }
  );
  assert.equal(capabilityDenied.status, 403);
  const invalidCapability = await apiRequest(
    targets.reconstructed,
    `/api/kiosk/devices/${kioskDevice.id}/capabilities`,
    {
      method: "PATCH",
      headers: bearer("admin"),
      body: JSON.stringify({ ledEnabled: "yes" }),
    }
  );
  assert.equal(invalidCapability.status, 400);
  const capability = await apiRequest(
    targets.reconstructed,
    `/api/kiosk/devices/${kioskDevice.id}/capabilities`,
    {
      method: "PATCH",
      headers: bearer("admin"),
      body: JSON.stringify({ nfcEnabled: true, ledEnabled: true }),
    }
  );
  assert.equal(capability.status, 200);
  assert.equal(capability.body.nfcEnabled, true);
  assert.equal(capability.body.ledEnabled, true);
  const capabilityContext = await apiRequest(targets.reconstructed, "/api/kiosk/context", { headers: kioskHeaders() });
  assert.equal(capabilityContext.status, 200);
  assert.equal(capabilityContext.body.device.nfcEnabled, true);
  assert.equal(capabilityContext.body.device.ledEnabled, true);

  const replacement = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identities.room.email, password: "RoomTablet123!", deviceName: "Replacement Tablet" }),
  });
  assert.equal(replacement.status, 200);
  const revoked = await apiRequest(targets.reconstructed, `/api/kiosk/devices/${replacement.body.device.id}`, {
    method: "DELETE",
    headers: bearer("admin"),
  });
  assert.equal(revoked.status, 200);
  const rejectedAccess = await apiRequest(targets.reconstructed, "/api/kiosk/context", {
    headers: { Authorization: `Bearer ${replacement.body.token}` },
  });
  assert.equal(rejectedAccess.status, 401);
  const rejectedRefresh = await apiRequest(targets.reconstructed, "/api/kiosk/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: replacement.body.refreshToken }),
  });
  assert.equal(rejectedRefresh.status, 401);
});

test("kiosk context and schedule are bound to one room with a safe projection", async () => {
  const roomTwoEvent = await createMeeting({
    room: "room-two@room.com",
    subject: "Private room two meeting",
    start: "2030-01-15T03:00:00.000Z",
    end: "2030-01-15T04:00:00.000Z",
  });
  assert.equal(roomTwoEvent.status, 200);

  const context = await apiRequest(targets.reconstructed, "/api/kiosk/context", { headers: kioskHeaders() });
  assert.equal(context.status, 200);
  assert.equal(context.body.room._id, identities.room._id);
  assert.ok(context.body.settings.available_color);

  const schedule = await apiRequest(
    targets.reconstructed,
    "/api/kiosk/schedule?start=20300101&end=20300131&rooms=room-two%40room.com",
    { headers: kioskHeaders() }
  );
  assert.equal(schedule.status, 200);
  assert.ok(schedule.body.some((event) => event.id === "60000000-0000-4000-8000-000000000001"));
  assert.equal(schedule.body.some((event) => event.id === roomTwoEvent.body[0].id), false);
  for (const event of schedule.body) {
    assert.deepEqual(Object.keys(event).sort(), [
      "canCheckIn", "canFinish", "checkedIn", "end", "id", "organizerFirstName", "start", "timezone", "title",
    ]);
    assert.equal(event.title.includes("Private"), false);
  }
});

test("kiosk check-in and early finish require room ownership and an authorized card", async () => {
  const now = Date.now();
  const own = await createMeeting({
    room: identities.room.email,
    subject: "Kiosk active meeting",
    start: new Date(now - 60_000).toISOString(),
    end: new Date(now + 20 * 60_000).toISOString(),
  });
  const other = await createMeeting({
    room: "room-two@room.com",
    subject: "Other room active meeting",
    start: new Date(now - 60_000).toISOString(),
    end: new Date(now + 20 * 60_000).toISOString(),
  });
  assert.equal(own.status, 200);
  assert.equal(other.status, 200);

  const crossRoom = await apiRequest(targets.reconstructed, "/api/kiosk/events/check-in", {
    method: "PUT",
    headers: kioskHeaders(),
    body: JSON.stringify({ event_id: other.body[0].id, card_number: "TEST-MASTER-CARD" }),
  });
  assert.equal(crossRoom.status, 404);

  const wrongCard = await apiRequest(targets.reconstructed, "/api/kiosk/events/check-in", {
    method: "PUT",
    headers: kioskHeaders(),
    body: JSON.stringify({ event_id: own.body[0].id, card_number: "UNKNOWN-CARD" }),
  });
  assert.equal(wrongCard.status, 403);

  const checked = await apiRequest(targets.reconstructed, "/api/kiosk/events/check-in", {
    method: "PUT",
    headers: kioskHeaders(),
    body: JSON.stringify({ event_id: own.body[0].id, card_number: "TEST-MASTER-CARD" }),
  });
  assert.equal(checked.status, 200);

  const finished = await apiRequest(targets.reconstructed, "/api/kiosk/events/early-finish", {
    method: "PUT",
    headers: kioskHeaders(),
    body: JSON.stringify({ event_id: own.body[0].id, card_number: "TEST-MASTER-CARD" }),
  });
  assert.equal(finished.status, 200);
  assert.equal(await queryParityDatabase(`SELECT end_date <= now() AT TIME ZONE timezone FROM tbl_events WHERE _id='${own.body[0].id}';`), "t");
});

test("deactivating the bound room revokes an issued kiosk token", async () => {
  try {
    await queryParityDatabase(`UPDATE tbl_users SET is_deleted=true WHERE _id='${identities.room._id}';`);
    const response = await apiRequest(targets.reconstructed, "/api/kiosk/context", { headers: kioskHeaders() });
    assert.equal(response.status, 401);
  } finally {
    await queryParityDatabase(`UPDATE tbl_users SET is_deleted=false WHERE _id='${identities.room._id}';`);
  }
});

test("changing a room password revokes every paired device", async () => {
  const changed = await apiRequest(targets.reconstructed, "/api/users/change-password", {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({
      userId: identities.room._id,
      newPassword: "ChangedRoom123!",
      newPasswordConfirmation: "ChangedRoom123!",
    }),
  });
  assert.equal(changed.status, 200);
  const access = await apiRequest(targets.reconstructed, "/api/kiosk/context", { headers: kioskHeaders() });
  assert.equal(access.status, 401);
  const refresh = await apiRequest(targets.reconstructed, "/api/kiosk/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: kioskRefreshToken }),
  });
  assert.equal(refresh.status, 401);
});

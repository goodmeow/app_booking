import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, ids, identities } from "../parity/fixtures.js";

let server;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
});

after(async () => stopServer(server));

test("room schedule exposes only a safe busy projection to unrelated users", async () => {
  const response = await apiRequest(
    targets.reconstructed,
    "/api/events?rooms=room-one%40room.com&start=20300101&end=20300131",
    { headers: bearer("viewer") }
  );
  assert.equal(response.status, 200);
  const event = response.body.find((item) => item.id === ids.event);
  assert.ok(event);
  assert.equal(event.visibility, "busy");
  assert.equal(event.can_view_details, false);
  assert.equal(event.organizer_first_name, "Test");
  assert.match(event.title, /^\[Test, \d{2}:\d{2} - \d{2}:\d{2}\]$/);
  for (const field of ["subject", "description", "organizer", "attendees", "checked_in", "late_threshold", "created_at"]) {
    assert.equal(Object.hasOwn(event, field), false, field);
  }
});

test("personal schedule identity cannot be selected through query parameters", async () => {
  const response = await apiRequest(
    targets.reconstructed,
    "/api/events?users=admin%40example.test&start=20300101&end=20300131",
    { headers: bearer("viewer") }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("room filter rejects an employee identity", async () => {
  const response = await apiRequest(
    targets.reconstructed,
    "/api/events?rooms=user%40example.test&start=20300101&end=20300131",
    { headers: bearer("viewer") }
  );
  assert.equal(response.status, 404);
});

test("guessed event IDs cannot reveal or mutate another organizer's event", async () => {
  const attempts = [
    ["GET", `/api/events/details?event_id=${ids.event}`],
    ["PUT", "/api/events", { id: ids.event, organizer: identities.viewer.email, subject: "Taken over", start_date: "2030-01-15T03:00:00.000Z", end_date: "2030-01-15T04:00:00.000Z" }],
    ["POST", "/api/events/attendee", [{ event_id: ids.event, attendee_email: identities.viewer.email }]],
    ["DELETE", `/api/events/details?event_detail_id=${ids.eventDetail}`],
    ["PUT", "/api/events/early-finish", { event_id: ids.event }],
  ];
  for (const [method, pathname, body] of attempts) {
    const response = await apiRequest(targets.reconstructed, pathname, {
      method,
      headers: bearer("viewer"),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, 403, `${method} ${pathname}`);
  }
  assert.equal(await queryParityDatabase(`SELECT subject FROM tbl_events WHERE _id = '${ids.event}';`), "Test Meeting");
});

test("non-admin settings mutation and cross-user profile reads are forbidden", async () => {
  const settings = await apiRequest(targets.reconstructed, "/api/settings", {
    method: "PUT",
    headers: bearer("user"),
    body: JSON.stringify({ id: ids.settings }),
  });
  assert.equal(settings.status, 403);

  const profile = await apiRequest(
    targets.reconstructed,
    `/api/users/${identities.admin._id}`,
    { headers: bearer("user") }
  );
  assert.equal(profile.status, 403);
});

test("room discovery never exposes card or account internals", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/rooms", { headers: bearer("user") });
  assert.equal(response.status, 200);
  assert.ok(response.body.length > 0);
  for (const room of response.body) {
    for (const field of ["card_number", "password", "role_id", "is_deleted", "created_at", "updated_at"]) {
      assert.equal(Object.hasOwn(room, field), false, field);
    }
  }
});

test("room accounts require no employee role and ignore role assignment", async () => {
  const created = await apiRequest(targets.reconstructed, "/api/rooms", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      name: "Roleless Room",
      email: "roleless-room@room.test",
      password: "SecurePass123!",
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.type, "room");
  assert.equal(
    await queryParityDatabase("SELECT COALESCE(role_id::text, 'none') FROM tbl_users WHERE email='roleless-room@room.test';"),
    "none"
  );

  const updated = await apiRequest(targets.reconstructed, `/api/rooms/${created.body._id}`, {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({
      name: "Roleless Room Updated",
      email: "roleless-room@room.test",
      roleId: "471ba030-c950-41f9-90da-4e0fe10426a6",
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(
    await queryParityDatabase("SELECT COALESCE(role_id::text, 'none') FROM tbl_users WHERE email='roleless-room@room.test';"),
    "none"
  );
});

test("identity validation prevents ambiguous email and username namespaces", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/users", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      name: "Invalid Namespace",
      email: "valid@example.test",
      username: "other@example.test",
      employee_id: "EMP-INVALID-NAMESPACE",
      password: "SecurePass123!",
      roleId: "471ba030-c950-41f9-90da-4e0fe10426a6",
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_USERNAME");
});

test("profile and room updates preserve an omitted username", async () => {
  await queryParityDatabase(`UPDATE tbl_users SET username='kept.user' WHERE _id='${identities.user._id}';`);
  const profile = await apiRequest(targets.reconstructed, `/api/users/${identities.user._id}`, {
    method: "PUT",
    headers: bearer("user"),
    body: JSON.stringify({ name: identities.user.name, email: identities.user.email }),
  });
  assert.equal(profile.status, 200);
  assert.equal(await queryParityDatabase(`SELECT username FROM tbl_users WHERE _id='${identities.user._id}';`), "kept.user");

  await queryParityDatabase(`UPDATE tbl_users SET username='kept.room' WHERE _id='${identities.room._id}';`);
  const room = await apiRequest(targets.reconstructed, `/api/rooms/${identities.room._id}`, {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ name: identities.room.name, email: identities.room.email }),
  });
  assert.equal(room.status, 200);
  assert.equal(await queryParityDatabase(`SELECT username FROM tbl_users WHERE _id='${identities.room._id}';`), "kept.room");
});

test("CORS rejects untrusted origins with a typed policy response", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/rooms", {
    headers: { ...bearer("user"), Origin: "https://evil.example" },
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "CORS_ORIGIN");
});

test("retiring a role revokes existing JWT privileges", async () => {
  try {
    await queryParityDatabase("UPDATE tbl_role SET is_deleted=true WHERE lower(role_name)='admin';");
    const response = await apiRequest(targets.reconstructed, "/api/settings/card-master", { headers: bearer("admin") });
    assert.equal(response.status, 401);
  } finally {
    await queryParityDatabase("UPDATE tbl_role SET is_deleted=false WHERE lower(role_name)='admin';");
  }
});

test("public signup follows the admin switch and ignores requested privilege", async () => {
  const signup = () => apiRequest(targets.reconstructed, "/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Domain Neutral",
      email: "domain-neutral@room.com",
      username: "domain.neutral",
      password: "SecurePass123!",
      role: "ADMIN",
      roleId: "471ba030-c950-41f9-90da-4e0fe10426a6",
      type: "room",
    }),
  });

  const publicFlag = await apiRequest(targets.reconstructed, "/api/settings/public");
  assert.equal(publicFlag.status, 200);
  assert.equal(publicFlag.body.self_signup_enabled, false);

  const disabled = await signup();
  assert.equal(disabled.status, 403);
  assert.equal(disabled.body.code, "SIGNUP_DISABLED");

  await queryParityDatabase("UPDATE tbl_app_settings SET self_signup_enabled = true;");
  try {
    const enabledFlag = await apiRequest(targets.reconstructed, "/api/settings/public");
    assert.equal(enabledFlag.body.self_signup_enabled, true);

    const enabled = await signup();
    assert.equal(enabled.status, 201);
    assert.equal(
      await queryParityDatabase("SELECT type || '|' || lower(r.role_name) FROM tbl_users u JOIN tbl_role r ON r._id=u.role_id WHERE u.email='domain-neutral@room.com';"),
      "employee|user"
    );
  } finally {
    await queryParityDatabase("UPDATE tbl_app_settings SET self_signup_enabled = false;");
  }
});

test("inactive accounts are rejected even when their JWT is still valid", async () => {
  await queryParityDatabase(`UPDATE tbl_users SET is_deleted=true WHERE _id='${identities.viewer._id}';`);
  const response = await apiRequest(targets.reconstructed, "/api/users", { headers: bearer("viewer") });
  assert.equal(response.status, 401);
});

test("room status respects the caller's floor scope", async () => {
  await queryParityDatabase(
    `UPDATE tbl_users SET floor = '9', floors = ARRAY['9'] WHERE _id = '${identities.user._id}';`
  );
  const userStatus = await apiRequest(targets.reconstructed, "/api/rooms/status", {
    headers: bearer("user"),
  });
  assert.equal(userStatus.status, 200);
  assert.deepEqual(userStatus.body, []);

  const adminStatus = await apiRequest(targets.reconstructed, "/api/rooms/status", {
    headers: bearer("admin"),
  });
  assert.equal(adminStatus.status, 200);
  assert.ok(adminStatus.body.length > 0);
});

test("only an admin may delete another account and an admin cannot delete itself", async () => {
  const ownAsUser = await apiRequest(
    targets.reconstructed,
    `/api/users/${identities.user._id}`,
    { method: "DELETE", headers: bearer("user") }
  );
  assert.equal(ownAsUser.status, 403);

  const otherAsUser = await apiRequest(
    targets.reconstructed,
    `/api/users/${identities.viewer._id}`,
    { method: "DELETE", headers: bearer("user") }
  );
  assert.equal(otherAsUser.status, 403);

  const ownAsAdmin = await apiRequest(
    targets.reconstructed,
    `/api/users/${identities.admin._id}`,
    { method: "DELETE", headers: bearer("admin") }
  );
  assert.equal(ownAsAdmin.status, 403);
  assert.equal(
    await queryParityDatabase(`SELECT is_deleted FROM tbl_users WHERE _id = '${identities.admin._id}';`),
    "f"
  );
});

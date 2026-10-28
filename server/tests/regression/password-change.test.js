import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer } from "../parity/fixtures.js";

// Imported accounts (and admin password resets) carry must_change_password.
// Until the owner replaces that password, every endpoint except the change
// itself and sign-out is refused with 403 PASSWORD_CHANGE_REQUIRED.

const USER_ROLE_ID = "67e9500b-908a-497d-9d3b-54bc020700cb";
const DEFAULT_PASSWORD = "DefaultPass123!";
const NEW_PASSWORD = "NewPass123!";

let server;
let employee;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  const created = await apiRequest(targets.reconstructed, "/api/users", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      name: "Forced Password Employee",
      email: "forced.password@example.test",
      employee_id: "EMP-FORCE-PASSWORD",
      password: DEFAULT_PASSWORD,
      roleId: USER_ROLE_ID,
      must_change_password: true,
    }),
  });
  assert.equal(created.status, 201);
  employee = created.body;
});

after(async () => stopServer(server));

const signin = (password) => apiRequest(targets.reconstructed, "/api/auth/signin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "forced.password@example.test", password }),
});

test("first login is blocked until the default password is replaced", async () => {
  const login = await signin(DEFAULT_PASSWORD);
  assert.equal(login.status, 200);
  assert.equal(login.body.user.mustChangePassword, true);
  const token = login.body.token;

  const blocked = await apiRequest(targets.reconstructed, "/api/users", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");

  // Sign-out must stay reachable from the forced screen.
  const out = await apiRequest(targets.reconstructed, "/api/auth/signout", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(out.status, 200);

  const mismatch = await apiRequest(targets.reconstructed, "/api/users/change-password", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      oldPassword: DEFAULT_PASSWORD,
      newPassword: NEW_PASSWORD,
      newPasswordConfirmation: "Different123!",
    }),
  });
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.body.code, "INVALID_PASSWORD");

  const changed = await apiRequest(targets.reconstructed, "/api/users/change-password", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      oldPassword: DEFAULT_PASSWORD,
      newPassword: NEW_PASSWORD,
      newPasswordConfirmation: NEW_PASSWORD,
    }),
  });
  assert.equal(changed.status, 200);
  assert.ok(changed.body.token, "a self password change must return a replacement token");

  const oldToken = await apiRequest(targets.reconstructed, "/api/users", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(oldToken.status, 401);
  const allowed = await apiRequest(targets.reconstructed, "/api/users", { headers: { Authorization: `Bearer ${changed.body.token}` } });
  assert.equal(allowed.status, 200);
  assert.equal(
    String(await queryParityDatabase(`SELECT must_change_password FROM tbl_users WHERE _id = '${employee._id}';`)),
    "f"
  );

  const relogin = await signin(NEW_PASSWORD);
  assert.equal(relogin.status, 200);
  assert.equal(relogin.body.user.mustChangePassword, false);
});

test("an admin can toggle the forced change flag without resetting the password", async () => {
  const setFlag = (value) => apiRequest(targets.reconstructed, `/api/users/${employee._id}`, {
    method: "PUT",
    headers: { ...bearer("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({ must_change_password: value }),
  });

  const enabled = await setFlag(true);
  assert.equal(enabled.status, 200);
  assert.equal(
    String(await queryParityDatabase(`SELECT must_change_password FROM tbl_users WHERE _id = '${employee._id}';`)),
    "t"
  );

  const disabled = await setFlag(false);
  assert.equal(disabled.status, 200);
  assert.equal(
    String(await queryParityDatabase(`SELECT must_change_password FROM tbl_users WHERE _id = '${employee._id}';`)),
    "f"
  );
});

test("an admin password reset puts the flag back", async () => {
  const resetPassword = "ResetPass123!";
  const reset = await apiRequest(targets.reconstructed, "/api/users/change-password", {
    method: "PUT",
    headers: { ...bearer("admin"), "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: employee._id,
      newPassword: resetPassword,
      newPasswordConfirmation: resetPassword,
    }),
  });
  assert.equal(reset.status, 200);
  assert.equal(
    String(await queryParityDatabase(`SELECT must_change_password FROM tbl_users WHERE _id = '${employee._id}';`)),
    "t"
  );

  const login = await signin(resetPassword);
  assert.equal(login.status, 200);
  assert.equal(login.body.user.mustChangePassword, true);
});

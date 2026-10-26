import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import {
  apiRequest,
  queryParityDatabase,
  resetParityDatabase,
  startServer,
  stopServer,
  targets,
  testSecret,
} from "../parity/harness.js";
import { bearer, ids, identities } from "../parity/fixtures.js";

let server;

const SECOND_ADMIN_ID = "20000000-0000-4000-8000-000000000009";
const SECOND_ADMIN_EMAIL = "second.admin@example.test";

const secondAdminBearer = () => {
  const token = jwt.sign(
    { email: SECOND_ADMIN_EMAIL, name: "Second Admin", role: "ADMIN" },
    testSecret,
    {
      algorithm: "HS256",
      subject: SECOND_ADMIN_ID,
      issuer: "360-scheduler",
      audience: "360-scheduler-web",
      expiresIn: "1h",
    }
  );
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

const setMenu = (roleName, menuKey, allowed) => apiRequest(
  targets.reconstructed,
  "/api/access/matrix",
  {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ access: [{ role_name: roleName, menu_key: menuKey, allowed }] }),
  }
);

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  // The parity seed has no super admin. Promote the fixture admin so the
  // matrix endpoints can be exercised with its existing signed token.
  await queryParityDatabase(`
    UPDATE tbl_users
    SET role_id = (SELECT _id FROM tbl_role WHERE lower(role_name) = 'super_admin')
    WHERE _id = '${identities.admin._id}';
  `);
  await queryParityDatabase(`
    INSERT INTO tbl_users
      (_id, name, email, password, role_id, employee_id, type, floors, is_deleted)
    VALUES
      ('${SECOND_ADMIN_ID}', 'Second Admin', '${SECOND_ADMIN_EMAIL}', 'x',
       (SELECT _id FROM tbl_role WHERE lower(role_name) = 'admin'),
       'EMP-SECOND', 'employee', '{}', false);
  `);
});

after(async () => stopServer(server));

test("a non-super admin cannot read or write the role matrix", async () => {
  const read = await apiRequest(targets.reconstructed, "/api/access/matrix", {
    headers: secondAdminBearer(),
  });
  assert.equal(read.status, 403);

  const write = await apiRequest(targets.reconstructed, "/api/access/matrix", {
    method: "PUT",
    headers: secondAdminBearer(),
    body: JSON.stringify({ access: [] }),
  });
  assert.equal(write.status, 403);
});

test("disabling the Users menu blocks user management and is audited", async () => {
  const disabled = await setMenu("admin", "users", false);
  assert.equal(disabled.status, 200);

  const create = await apiRequest(targets.reconstructed, "/api/users", {
    method: "POST",
    headers: secondAdminBearer(),
    body: JSON.stringify({}),
  });
  assert.equal(create.status, 403);

  const audit = await queryParityDatabase(
    "SELECT count(*) FROM tbl_audit_log WHERE action = 'access.update';"
  );
  assert.ok(Number(audit) >= 1);
});

test("a normal admin cannot reset the super admin password", async () => {
  await setMenu("admin", "users", true);
  const response = await apiRequest(targets.reconstructed, "/api/users/change-password", {
    method: "PUT",
    headers: secondAdminBearer(),
    body: JSON.stringify({
      userId: identities.admin._id,
      newPassword: "ReplacementPassword123!",
      newPasswordConfirmation: "ReplacementPassword123!",
    }),
  });
  assert.equal(response.status, 403);
});

test("resetting another password requires the Users menu", async () => {
  await setMenu("admin", "users", false);
  const response = await apiRequest(targets.reconstructed, "/api/users/change-password", {
    method: "PUT",
    headers: secondAdminBearer(),
    body: JSON.stringify({
      userId: identities.user._id,
      newPassword: "ReplacementPassword123!",
      newPasswordConfirmation: "ReplacementPassword123!",
    }),
  });
  assert.equal(response.status, 403);

  const restore = await setMenu("admin", "users", true);
  assert.equal(restore.status, 200);
});

test("settings read without the Settings menu returns no sensitive fields", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/settings", {
    headers: bearer("user"),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body._id, ids.settings);
  assert.equal(Object.hasOwn(response.body, "backup_path"), false);
  assert.equal(Object.hasOwn(response.body, "lock_timer"), false);
});

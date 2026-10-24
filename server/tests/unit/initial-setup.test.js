import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ADMIN_EMPLOYEE_ID, normalizedSetupBody, setupRequired } from "../../features/setup/setup.service.js";

test("setup is required only for a fresh database", () => {
  assert.equal(setupRequired({ setup_completed: false, has_admin: false }), true);
  // A missing settings row is the same as an unfinished setup.
  assert.equal(setupRequired({}), true);
  assert.equal(setupRequired(undefined), true);
  assert.equal(setupRequired({ setup_completed: undefined, has_admin: undefined }), true);

  assert.equal(setupRequired({ setup_completed: true, has_admin: false }), false);
  assert.equal(setupRequired({ setup_completed: false, has_admin: true }), false);
  assert.equal(setupRequired({ setup_completed: true, has_admin: true }), false);
});

test("setup does not trust non-boolean completed values", () => {
  assert.equal(setupRequired({ setup_completed: "true", has_admin: false }), true);
  assert.equal(setupRequired({ setup_completed: 1, has_admin: false }), true);
  assert.equal(setupRequired({ setup_completed: null, has_admin: null }), true);
});

test("setup body is normalized before it reaches the database", () => {
  const values = normalizedSetupBody({
    name: "  First Admin  ",
    email: "  First.Admin@Example.Test ",
    password: "Bootstrap123!",
  });
  assert.deepEqual(values, {
    name: "First Admin",
    email: "first.admin@example.test",
    password: "Bootstrap123!",
    employeeId: DEFAULT_ADMIN_EMPLOYEE_ID,
  });
});

test("setup accepts a custom employee id and the snake_case alias", () => {
  assert.equal(
    normalizedSetupBody({ name: "Admin", email: "admin@example.test", password: "Bootstrap123!", employeeId: " EMP-9 " }).employeeId,
    "EMP-9"
  );
  assert.equal(
    normalizedSetupBody({ name: "Admin", email: "admin@example.test", password: "Bootstrap123!", employee_id: "EMP-10" }).employeeId,
    "EMP-10"
  );
});

test("setup rejects malformed fields with the shared validation codes", () => {
  const valid = { name: "Admin", email: "admin@example.test", password: "Bootstrap123!" };

  assert.throws(() => normalizedSetupBody({ ...valid, name: "   " }), { code: "INVALID_SETUP" });
  assert.throws(() => normalizedSetupBody({ ...valid, email: "not-an-email" }), { code: "INVALID_EMAIL" });
  assert.throws(() => normalizedSetupBody({ ...valid, password: "short" }), { code: "INVALID_PASSWORD" });
  assert.throws(() => normalizedSetupBody({ ...valid, employeeId: "bad id!" }), { code: "INVALID_EMPLOYEE_ID" });
});

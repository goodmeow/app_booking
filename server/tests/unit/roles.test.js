import assert from "node:assert/strict";
import { test } from "node:test";
import { isAdminRole, isSuperAdminRole } from "../../lib/roles.js";

test("super admin is an administrator and keeps the fixed flag", () => {
  assert.equal(isAdminRole("SUPER_ADMIN"), true);
  assert.equal(isSuperAdminRole("super_admin"), true);
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isSuperAdminRole("ADMIN"), false);
  assert.equal(isAdminRole("RECEPTIONIST"), false);
  assert.equal(isAdminRole(null), false);
});

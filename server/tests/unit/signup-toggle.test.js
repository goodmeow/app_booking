import assert from "node:assert/strict";
import { test } from "node:test";
import { signupAllowed } from "../../features/auth/auth.service.js";

test("self signup only runs when the setting is explicitly true", () => {
  assert.equal(signupAllowed(true), true);
  assert.equal(signupAllowed(false), false);
  // A missing settings row or a non-boolean value must fail closed.
  assert.equal(signupAllowed(undefined), false);
  assert.equal(signupAllowed(null), false);
  assert.equal(signupAllowed("true"), false);
  assert.equal(signupAllowed(1), false);
});

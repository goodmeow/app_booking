import assert from "node:assert/strict";
import test from "node:test";
import { stateFromError, stateFromProps } from "../components/common/error-boundary-state.js";
import { hasFloor } from "../management/user-form.js";

test("hasFloor treats empty and whitespace floors as unset", () => {
  assert.equal(hasFloor({ floor: "3" }), true);
  assert.equal(hasFloor({ floor: "all" }), true);
  assert.equal(hasFloor({ floor: "" }), false);
  assert.equal(hasFloor({ floor: "  " }), false);
  assert.equal(hasFloor({ floor: null }), false);
  assert.equal(hasFloor({}), false);
});

test("error boundary state captures errors and resets when the route key changes", () => {
  const error = new Error("boom");
  assert.deepEqual(stateFromError(error), { error });
  assert.equal(stateFromProps({ resetKey: "/a" }, { error, resetKey: "/a" }), null);
  assert.deepEqual(stateFromProps({ resetKey: "/b" }, { error, resetKey: "/a" }), { error: null, resetKey: "/b" });
});

import assert from "node:assert/strict";
import test from "node:test";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";

test("unwraps CommonJS icon modules without changing React components", () => {
  const component = { $$typeof: Symbol.for("react.forward_ref") };
  assert.equal(resolveMuiIcon({ default: component }), component);
  assert.equal(resolveMuiIcon({ default: { default: component } }), component);
  assert.equal(resolveMuiIcon(component), component);
});

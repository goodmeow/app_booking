import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { prepareLegacyBundle, targets } from "./harness.js";
import { identities, tokens } from "./fixtures.js";

test("parity harness prepares isolated legacy runtime", async () => {
  const runtime = await prepareLegacyBundle();
  const stat = await fs.stat(runtime);
  assert.ok(stat.size > 0);
  assert.match(runtime, /legacy\.bundle\.cjs$/);
  assert.notEqual(targets.legacy.port, targets.reconstructed.port);
});

test("parity fixtures provide deterministic role identities", () => {
  assert.equal(identities.admin.role, "ADMIN");
  assert.equal(identities.user.role, "USER");
  assert.ok(tokens.admin);
  assert.ok(tokens.user);
});

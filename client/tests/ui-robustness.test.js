import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stateFromError, stateFromProps } from "../components/common/error-boundary-state.js";
import { hasFloor } from "../management/user-form.js";

const clientDir = path.resolve(import.meta.dirname, "..");
const sources = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === "tests" ? [] : sources(full);
  return entry.name.endsWith(".js") ? [full] : [];
});

// Impor ikon MUI mentah menghasilkan objek (bukan komponen) di build Vite dan
// membuat seluruh halaman kosong. Semua ikon harus lewat resolveMuiIcon.
test("every MUI icon import is wrapped in resolveMuiIcon", () => {
  const offenders = [];
  for (const file of sources(clientDir)) {
    const text = fs.readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/^import\s+(\w+)\s+from\s+"@mui\/icons-material\/[^"]+";/gm)) {
      if (!text.includes(`resolveMuiIcon(${name})`)) offenders.push(`${path.relative(clientDir, file)}: ${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});

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

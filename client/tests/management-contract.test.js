import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getApiError } from "../domain/api-error.js";
import { ROLE_IDS, ROLE_OPTIONS } from "../domain/roles.js";

test("uses recovered role UUIDs", () => {
  assert.equal(ROLE_IDS.ADMIN, "471ba030-c950-41f9-90da-4e0fe10426a6");
  assert.equal(ROLE_IDS.USER, "67e9500b-908a-497d-9d3b-54bc020700cb");
  assert.deepEqual(ROLE_OPTIONS.map(({ label }) => label), ["Admin", "User"]);
});

test("normalizes RTK Query and Error messages", () => {
  assert.equal(getApiError({ data: { error: "Database rejected request" } }), "Database rejected request");
  assert.equal(getApiError(new Error("Network failed")), "Network failed");
  assert.equal(getApiError(null, "Fallback"), "Fallback");
});

test("kiosk management exposes independent NFC and LED capability toggles", () => {
  const service = fs.readFileSync(new URL("../redux/services/kiosk-devices.js", import.meta.url), "utf8");
  const section = fs.readFileSync(new URL("../management/KioskDeviceManagementSection.js", import.meta.url), "utf8");
  assert.match(service, /\/capabilities/);
  assert.match(service, /method: "PATCH"/);
  assert.match(section, /"nfcEnabled"/);
  assert.match(section, /"ledEnabled"/);
});

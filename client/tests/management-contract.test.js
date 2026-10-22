import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getApiError } from "../domain/api-error.js";
import { ROLE_IDS, ROLE_OPTIONS } from "../domain/roles.js";
import { createEmptyUserForm } from "../management/user-form.js";

test("uses recovered role UUIDs", () => {
  assert.equal(ROLE_IDS.ADMIN, "471ba030-c950-41f9-90da-4e0fe10426a6");
  assert.equal(ROLE_IDS.USER, "67e9500b-908a-497d-9d3b-54bc020700cb");
  assert.deepEqual(ROLE_OPTIONS.map(({ labelKey }) => labelKey), ["roles.admin", "roles.user"]);
});

test("new users default to User role", () => {
  assert.equal(createEmptyUserForm().roleId, ROLE_IDS.USER);
});

test("normalizes RTK Query and Error messages", () => {
  const translate = (key) => ({
    "common:apiErrors.forbidden": "Tidak diizinkan",
    "common:states.error": "Kesalahan",
  }[key]);
  assert.equal(
    getApiError({ data: { code: "FORBIDDEN", error: "Forbidden" } }, undefined, translate),
    "Tidak diizinkan"
  );
  assert.equal(getApiError({ data: { error: "Database rejected request" } }), "Database rejected request");
  assert.equal(getApiError(new Error("Network failed")), "Network failed");
  assert.equal(getApiError(null, "Fallback"), "Fallback");
});

test("tablet management keeps the LED toggle and lets admin hide meeting titles", () => {
  const service = fs.readFileSync(new URL("../redux/services/kiosk-devices.js", import.meta.url), "utf8");
  const section = fs.readFileSync(new URL("../management/KioskDeviceManagementSection.js", import.meta.url), "utf8");
  assert.match(service, /\/capabilities/);
  assert.match(service, /method: "PATCH"/);
  // NFC sudah ditangani aplikasi kiosk, jadi tidak lagi diatur dari CMS.
  assert.doesNotMatch(section, /"nfcEnabled"/);
  assert.match(section, /"ledEnabled"/);
  // Toggle judul meeting (migrasi 011) bersebelahan dengan LED.
  assert.match(section, /"showSubject"/);
  // Service hanya meneruskan capability apa pun (passthrough PATCH).
  assert.match(service, /capabilities/);
  assert.match(section, /row\.online/);
});

test("admin shell uses tabs, hides technical ID columns, and merges cards into users", () => {
  const appManagement = fs.readFileSync(new URL("../management/AppManagement.js", import.meta.url), "utf8");
  const users = fs.readFileSync(new URL("../management/UserManagementSection.js", import.meta.url), "utf8");
  const rooms = fs.readFileSync(new URL("../management/RoomManagementSection.js", import.meta.url), "utf8");
  assert.match(appManagement, /<Tabs/);
  assert.match(appManagement, /value: "users"/);
  assert.match(appManagement, /value: "rooms"/);
  assert.match(appManagement, /value: "devices"/);
  // Akses kartu digabung ke tab Pengguna (ada flag master card), bukan tab sendiri.
  assert.doesNotMatch(appManagement, /value: "cards"/);
  assert.match(users, /field: "card_number"/);
  assert.match(users, /field: "is_master_card"/);
  assert.doesNotMatch(users, /field: "_id"/);
  assert.doesNotMatch(rooms, /field: "_id"/);
});

test("Phase 10B resource errors are retryable and routes have a not-found page", () => {
  const asyncState = fs.readFileSync(new URL("../components/common/AsyncState.js", import.meta.url), "utf8");
  const menu = fs.readFileSync(new URL("../core/Menu.js", import.meta.url), "utf8");
  const router = fs.readFileSync(new URL("../MainRouter.js", import.meta.url), "utf8");
  const calendar = fs.readFileSync(new URL("../calendar/MeetingCalendar.js", import.meta.url), "utf8");
  assert.match(asyncState, /onAction/);
  assert.match(asyncState, /actions\.retry/);
  assert.match(menu, /<Drawer/);
  assert.doesNotMatch(menu, /overflowX:\s*"auto"/);
  assert.match(router, /component=\{NotFound\}/);
  assert.match(calendar, /common:states\.refreshing/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getApiError } from "../domain/api-error.js";
import { ROLE_IDS, ROLE_OPTIONS, canBookForEmployees, canUseAllFloors, defaultScheduleModeForRole, isReceptionistRole, roomsForRole } from "../domain/roles.js";
import { createEmptyUserForm, EMPLOYEE_ID_MAX_LENGTH, employeeIdErrorKey } from "../management/user-form.js";
import {
  CARD_ACTIVE_LIMIT,
  activeCardCount,
  cardLimitReached,
  primaryCardNumber,
} from "../management/users/user-cards.js";
import { userMutationError } from "../management/users/user-api-errors.js";

test("uses recovered role UUIDs", () => {
  assert.equal(ROLE_IDS.ADMIN, "471ba030-c950-41f9-90da-4e0fe10426a6");
  assert.equal(ROLE_IDS.RECEPTIONIST, "3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73");
  assert.equal(ROLE_IDS.USER, "67e9500b-908a-497d-9d3b-54bc020700cb");
  assert.deepEqual(
    ROLE_OPTIONS.map(({ labelKey }) => labelKey),
    ["roles.admin", "roles.receptionist", "roles.user"]
  );
});

test("receptionist role can book for employees but only on its own floor", () => {
  assert.equal(isReceptionistRole("RECEPTIONIST"), true);
  assert.equal(isReceptionistRole("receptionist "), true);
  assert.equal(isReceptionistRole(ROLE_IDS.RECEPTIONIST), false);
  assert.equal(isReceptionistRole("USER"), false);
  assert.equal(canBookForEmployees("RECEPTIONIST"), true);
  assert.equal(canBookForEmployees("ADMIN"), true);
  assert.equal(canBookForEmployees("USER"), false);
  assert.equal(canBookForEmployees(undefined), false);

  const rooms = [
    { _id: "r1", name: "Garuda", floor: "2" },
    { _id: "r2", name: "Rajawali", floor: " 10 " },
    { _id: "r3", name: "Merpati", floor: "" },
  ];
  assert.deepEqual(roomsForRole(rooms, { role: "RECEPTIONIST", floor: "2" }).map(({ _id }) => _id), ["r1"]);
  assert.deepEqual(roomsForRole(rooms, { role: "RECEPTIONIST", floor: "9" }), []);
  // Employees are floor-scoped too: the server rejects other floors anyway.
  assert.deepEqual(roomsForRole(rooms, { role: "USER", floor: "2" }).map(({ _id }) => _id), ["r1"]);
  assert.deepEqual(roomsForRole(rooms, { role: "USER", floor: "" }), []);
  // Admins and the "all" floor group keep every room.
  assert.equal(roomsForRole(rooms, { role: "ADMIN", floor: "2", isAdmin: true }).length, 3);
  assert.equal(roomsForRole(rooms, { role: "RECEPTIONIST", floor: "all" }).length, 3);
  assert.equal(roomsForRole(rooms, { role: "USER", floor: "all" }).length, 3);
  assert.equal(roomsForRole(rooms, { role: "USER", floor: "2", isAdmin: true }).length, 3);
  assert.equal(canUseAllFloors({ role: "USER", floor: "2" }), false);
  assert.equal(canUseAllFloors({ role: "RECEPTIONIST", floor: "ALL" }), true);
  assert.deepEqual(roomsForRole(undefined, { role: "RECEPTIONIST", floor: "2" }), []);

  // The calendar must not open an empty "my schedule" for the front desk: the
  // default scope is the floor it serves, and every room in the dropdown comes
  // from that same scope.
  assert.equal(defaultScheduleModeForRole("RECEPTIONIST"), "floor");
  assert.equal(defaultScheduleModeForRole("ADMIN"), "all");
  assert.equal(defaultScheduleModeForRole("USER"), "mine");
  assert.equal(defaultScheduleModeForRole(undefined), "mine");
});

test("new users default to User role", () => {
  assert.equal(createEmptyUserForm().roleId, ROLE_IDS.USER);
});

test("employee ID stays empty on a new form and is validated before submit", () => {
  assert.equal(createEmptyUserForm().employee_id, "");
  assert.equal(employeeIdErrorKey(""), "users.employeeIdRequired");
  assert.equal(employeeIdErrorKey("   "), "users.employeeIdRequired");
  assert.equal(employeeIdErrorKey(undefined), "users.employeeIdRequired");
  assert.equal(employeeIdErrorKey("EMP-001"), null);
  assert.equal(employeeIdErrorKey(" emp_001 "), null);
  assert.equal(employeeIdErrorKey("EMP 001"), "users.employeeIdInvalid");
  assert.equal(employeeIdErrorKey("EMP/001"), "users.employeeIdInvalid");
  assert.equal(employeeIdErrorKey("A".repeat(EMPLOYEE_ID_MAX_LENGTH)), null);
  assert.equal(employeeIdErrorKey("A".repeat(EMPLOYEE_ID_MAX_LENGTH + 1)), "users.employeeIdInvalid");
});

test("card helpers count active cards only and know the two-card limit", () => {
  const cards = [
    { id: "c1", card_number: "AAA", status: "active" },
    { id: "c2", card_number: "BBB", status: "lost" },
  ];
  assert.equal(CARD_ACTIVE_LIMIT, 2);
  assert.equal(activeCardCount({ cards }), 1);
  assert.equal(cardLimitReached({ cards }), false);
  assert.equal(primaryCardNumber({ cards }), "AAA");
  const twoActive = { cards: [...cards, { id: "c3", card_number: "CCC", status: "active" }] };
  assert.equal(activeCardCount(twoActive), 2);
  assert.equal(cardLimitReached(twoActive), true);
  // Older payloads still carry the flat card_number field.
  assert.equal(primaryCardNumber({ card_number: "LEGACY" }), "LEGACY");
  assert.equal(primaryCardNumber({}), "");
  assert.equal(activeCardCount({}), 0);
});

test("employee ID and card failures map to their management messages", () => {
  const translate = (key) => `t:${key}`;
  assert.equal(
    userMutationError({ data: { code: "EMPLOYEE_ID_EXISTS" } }, translate, "fallback"),
    "t:users.employeeIdExists"
  );
  assert.equal(
    userMutationError({ data: { code: "INVALID_EMPLOYEE_ID" } }, translate, "fallback"),
    "t:users.employeeIdInvalid"
  );
  assert.equal(userMutationError({ data: { code: "CARD_LIMIT" } }, translate, "fallback"), "t:users.cardLimit");
  assert.equal(userMutationError({ data: { code: "CARD_EXISTS" } }, translate, "fallback"), "t:users.cardExists");
  assert.equal(
    userMutationError({ data: { code: "CARD_ALREADY_ACTIVE" } }, translate, "fallback"),
    "t:users.cardAlreadyActive"
  );
  // Everything else keeps the shared API error translation or the fallback.
  assert.equal(
    userMutationError({ data: { code: "NOT_FOUND" } }, translate, "fallback"),
    "t:common:apiErrors.notFound"
  );
  assert.equal(userMutationError({ data: { error: "Database rejected request" } }, translate, "fallback"), "Database rejected request");
  assert.equal(userMutationError(null, translate, "fallback"), "fallback");
});

test("user grid and service expose employee ID and card management", () => {
  const userColumns = fs.readFileSync(new URL("../management/users/user-columns.js", import.meta.url), "utf8");
  const service = fs.readFileSync(new URL("../redux/services/users.js", import.meta.url), "utf8");
  const section = fs.readFileSync(new URL("../management/UserManagementSection.js", import.meta.url), "utf8");
  const dialog = fs.readFileSync(new URL("../management/users/UserCardsDialog.js", import.meta.url), "utf8");

  assert.match(userColumns, /field: "employee_id"/);
  assert.ok(
    userColumns.indexOf('field: "email"') < userColumns.indexOf('field: "employee_id"'),
    "employee ID column follows email"
  );
  assert.match(userColumns, /field: "employee_id",[\s\S]{0,120}minWidth: 130/);

  assert.match(service, /users\/\$\{userId\}\/cards/);
  assert.match(service, /method: "PATCH"/);
  assert.match(service, /status: "lost"/);
  assert.match(service, /status: "active"/);
  assert.match(service, /reactivateUserCard/);
  assert.match(service, /invalidatesTags: \["users"\]/);

  assert.match(section, /<UserCardsDialog/);
  assert.match(section, /onReactivate/);
  assert.match(dialog, /users\.cardLimit/);
  assert.match(dialog, /users\.cardMarkLost/);
  assert.match(dialog, /users\.cardReactivate/);
});

test("first login is forced through a password change screen", () => {
  const router = fs.readFileSync(new URL("../MainRouter.js", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../auth/ForcePasswordChange.js", import.meta.url), "utf8");
  assert.match(router, /ForcePasswordChange/);
  assert.match(router, /user\.mustChangePassword/);
  assert.match(page, /useChangePasswordMutation/);
  assert.match(page, /newPasswordConfirmation/);
  assert.match(page, /mustChangePassword: false/);
  assert.match(page, /users\/change-password|useChangePasswordMutation/);
  const form = fs.readFileSync(new URL("../management/users/UserFormDialog.js", import.meta.url), "utf8");
  assert.match(form, /must_change_password/);
  assert.match(form, /users\.mustChangePassword/);
});

test("normalizes RTK Query and Error messages", () => {
  const translate = (key) => ({
    "common:apiErrors.forbidden": "Not allowed",
    "common:states.error": "Kesalahan",
  }[key]);
  assert.equal(
    getApiError({ data: { code: "FORBIDDEN", error: "Forbidden" } }, undefined, translate),
    "Not allowed"
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
  // NFC is handled by the kiosk app, so it is no longer configured from the CMS.
  assert.doesNotMatch(section, /"nfcEnabled"/);
  assert.match(section, /"ledEnabled"/);
  // The meeting title toggle (migration 011) sits next to the LED.
  assert.match(section, /"showSubject"/);
  // The service just forwards any capability (PATCH passthrough).
  assert.match(service, /capabilities/);
  assert.match(section, /row\.online/);
});

test("admin shell uses tabs, hides technical ID columns, and merges cards into users", () => {
  const appManagement = fs.readFileSync(new URL("../management/AppManagement.js", import.meta.url), "utf8");
  const userColumns = fs.readFileSync(new URL("../management/users/user-columns.js", import.meta.url), "utf8");
  const rooms = fs.readFileSync(new URL("../management/RoomManagementSection.js", import.meta.url), "utf8");
  const roomColumns = fs.readFileSync(new URL("../management/rooms/room-columns.js", import.meta.url), "utf8");
  assert.match(appManagement, /<Tabs/);
  assert.match(appManagement, /value: "users"/);
  assert.match(appManagement, /value: "rooms"/);
  assert.match(appManagement, /value: "devices"/);
  // Card access is merged into the Users tab (it has the master card flag), not a tab of its own.
  assert.doesNotMatch(appManagement, /value: "cards"/);
  assert.match(userColumns, /field: "card_number"/);
  assert.match(userColumns, /field: "is_master_card"/);
  assert.doesNotMatch(userColumns, /field: "_id"/);
  assert.match(roomColumns, /field: "name"/);
  assert.doesNotMatch(rooms, /field: "_id"/);
  assert.doesNotMatch(roomColumns, /field: "_id"/);
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

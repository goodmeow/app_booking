import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVE_CARD_LIMIT,
  activeCardCount,
  activeCardLimitReached,
  addUserCard,
  identityConflictCode,
  markUserCardLost,
  normalizedEmployeeId,
  visibleAccount,
} from "../../features/users/user.service.js";

test("employee_id is trimmed and keeps the admin's casing", () => {
  assert.equal(normalizedEmployeeId("  EMP-001  "), "EMP-001");
  assert.equal(normalizedEmployeeId("emp-001"), "emp-001");
  assert.equal(normalizedEmployeeId(" EMP_001 "), "EMP_001");
});

test("employee_id is required when the caller asks for it", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.throws(
      () => normalizedEmployeeId(value, { required: true }),
      (error) => error.status === 400 && error.code === "INVALID_EMPLOYEE_ID"
    );
  }
  // An edit that omits the field leaves the stored value alone.
  assert.equal(normalizedEmployeeId(undefined), null);
});

test("employee_id accepts letters, digits, dots, dashes, and underscores", () => {
  for (const value of ["EMP 001", "x".repeat(41), "EMP/001", "EMP@001"]) {
    assert.throws(
      () => normalizedEmployeeId(value, { required: true }),
      (error) => error.status === 400 && error.code === "INVALID_EMPLOYEE_ID"
    );
  }
  assert.equal(normalizedEmployeeId("A".repeat(40)).length, 40);
  // BioTime employee codes use dots, for example "001-01.25".
  assert.equal(normalizedEmployeeId("001-01.25"), "001-01.25");
});

test("a duplicate employee_id reports its own conflict code", () => {
  const employeeIdConflict = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint: "tbl_users_employee_id_lower_key",
  });
  const emailConflict = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint: "tbl_users_email_lower_key",
  });
  assert.equal(identityConflictCode(employeeIdConflict), "EMPLOYEE_ID_EXISTS");
  assert.equal(identityConflictCode(emailConflict), "IDENTITY_EXISTS");
  assert.equal(identityConflictCode(Object.assign(new Error("other"), { code: "23503" })), null);
  assert.equal(identityConflictCode(undefined), null);
});

test("at most two active cards are allowed per user", () => {
  assert.equal(ACTIVE_CARD_LIMIT, 2);
  assert.equal(activeCardLimitReached([]), false);
  assert.equal(activeCardLimitReached([{ status: "active" }]), false);
  assert.equal(activeCardLimitReached([{ status: "active" }, { status: "active" }]), true);
});

test("a lost card stays in the list but does not count towards the limit", () => {
  const cards = [
    { status: "active" },
    { status: "lost" },
  ];
  assert.equal(activeCardCount(cards), 1);
  // The spare card slot is free again, so a replacement can be issued.
  assert.equal(activeCardLimitReached(cards), false);
  assert.equal(activeCardLimitReached([...cards, { status: "lost" }]), false);
  assert.equal(activeCardLimitReached([{ status: "active" }, ...cards]), true);
});

test("adding a card rejects an empty number before touching the database", async () => {
  for (const value of [undefined, "", "   "]) {
    await assert.rejects(
      () => addUserCard("20000000-0000-4000-8000-000000000002", value),
      (error) => error.status === 400 && error.code === "INVALID_CARD"
    );
  }
});

test("card helpers reject an identifier that is not a UUID", async () => {
  await assert.rejects(
    () => addUserCard("not-a-uuid", "DEMO-CARD"),
    (error) => error.status === 404 && error.code === "NOT_FOUND"
  );
  await assert.rejects(
    () => markUserCardLost("not-a-uuid", "also-not-a-uuid", { _id: null, role: "ADMIN" }),
    (error) => error.status === 404 && error.code === "NOT_FOUND"
  );
});

test("employee_id is hidden from non-admin responses, own cards are not", () => {
  const account = {
    _id: "20000000-0000-4000-8000-000000000002",
    name: "Test User",
    employee_id: "EMP-USER",
    cards: [{ id: "card-1", card_number: "DEMO-CARD", status: "active" }],
  };
  const self = visibleAccount(account, { _id: account._id, role: "USER" });
  assert.deepEqual(Object.keys(self).sort(), ["_id", "cards", "name"]);
  const admin = visibleAccount(account, { _id: "admin", role: "ADMIN" });
  assert.equal(admin.employee_id, "EMP-USER");
});

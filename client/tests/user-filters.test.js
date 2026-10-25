import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_IDS } from "../domain/roles.js";
import {
  filterUsers,
  ROLE_FILTER_ALL,
  roleLabel,
} from "../management/users/user-filters.js";

const users = [
  { _id: "u1", name: "Rina", email: "rina@contoh.id", employee_id: "EMP-001", floor: "2", role_id: ROLE_IDS.RECEPTIONIST },
  { _id: "u2", name: "Budi Santoso", email: "budi@contoh.id", employee_id: "EMP-002", floor: "2", role_id: ROLE_IDS.USER },
  { _id: "u3", name: "Sari", email: "sari@contoh.id", employee_id: "", floor: "", role_id: ROLE_IDS.USER },
  { _id: "u4", name: "Admin", email: "admin@contoh.id", employee_id: "ADM-9", floor: "all", role_id: ROLE_IDS.ADMIN },
];

test("search matches name, email, and employee id case-insensitively", () => {
  assert.deepEqual(filterUsers(users, { search: "rina" }).map(({ _id }) => _id), ["u1"]);
  assert.deepEqual(filterUsers(users, { search: "CONTOH.ID" }).length, 4);
  assert.deepEqual(filterUsers(users, { search: "emp-00" }).map(({ _id }) => _id), ["u1", "u2"]);
  assert.deepEqual(filterUsers(users, { search: "  adm-9  " }).map(({ _id }) => _id), ["u4"]);
  assert.deepEqual(filterUsers(users, { search: "nobody" }), []);
  assert.equal(filterUsers(users, { search: "" }).length, 4);
});

test("role filter keeps only the selected role and survives unknown ids", () => {
  assert.deepEqual(
    filterUsers(users, { roleId: ROLE_IDS.RECEPTIONIST }).map(({ _id }) => _id),
    ["u1"]
  );
  assert.deepEqual(
    filterUsers(users, { roleId: ROLE_IDS.USER }).map(({ _id }) => _id),
    ["u2", "u3"]
  );
  assert.equal(filterUsers(users, { roleId: ROLE_FILTER_ALL }).length, 4);
  assert.deepEqual(filterUsers(users, { roleId: "unknown-role" }), []);
});

test("search, role, and missing-floor filters combine", () => {
  assert.deepEqual(
    filterUsers(users, { search: "s", roleId: ROLE_IDS.USER, onlyMissingFloor: true }).map(({ _id }) => _id),
    ["u3"]
  );
  assert.deepEqual(
    filterUsers(users, { search: "rina", roleId: ROLE_IDS.USER }).length,
    0
  );
  assert.equal(filterUsers(users, { onlyMissingFloor: true }).length, 1);
  assert.deepEqual(filterUsers(undefined, { search: "x" }), []);
});

test("role labels come from the shared role options with a dash fallback", () => {
  const keyOf = (key) => key;
  assert.equal(roleLabel(keyOf, ROLE_IDS.ADMIN), "common:roles.admin");
  assert.equal(roleLabel(keyOf, ROLE_IDS.RECEPTIONIST), "common:roles.receptionist");
  assert.equal(roleLabel(keyOf, ROLE_IDS.USER), "common:roles.user");
  assert.equal(roleLabel(keyOf, "not-a-role"), "");
  assert.equal(roleLabel(keyOf, undefined), "");
});

import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_IDS } from "../domain/roles.js";
import { floorGroupRows, missingFloorCount } from "../management/floor-groups.js";

const rooms = [
  { _id: "r1", name: "Garuda", floor: "2" },
  { _id: "r2", name: "Rajawali", floor: "10" },
  { _id: "r3", name: "Cendrawasih", floor: "2" },
  { _id: "r4", name: "Auditorium", floor: "" },
];

const users = [
  { _id: "u1", name: "Rina", email: "rina@prasada.id", floor: "2", role_id: ROLE_IDS.RECEPTIONIST },
  { _id: "u2", name: "Budi", email: "budi@prasada.id", floor: "2", role_id: ROLE_IDS.USER },
  { _id: "u3", name: "Sari", email: "sari@prasada.id", floor: "10", role_id: ROLE_IDS.USER },
  { _id: "u4", name: "Tanpa Lantai", email: "none@prasada.id", floor: "", role_id: ROLE_IDS.USER },
  { _id: "u5", name: "Spasi", email: "space@prasada.id", floor: "  ", role_id: ROLE_IDS.USER },
];

test("counts employees that still have no floor group", () => {
  assert.equal(missingFloorCount(users), 2);
  assert.equal(missingFloorCount([]), 0);
  assert.equal(missingFloorCount(undefined), 0);
});

test("builds one read-only row per room floor with sorted names", () => {
  assert.deepEqual(floorGroupRows({ rooms, users }), [
    { floor: "2", roomCount: 2, employeeCount: 2, receptionists: ["Rina"] },
    { floor: "10", roomCount: 1, employeeCount: 1, receptionists: [] },
  ]);
});

test("floor rows survive missing data and other receptionist role ids", () => {
  assert.deepEqual(floorGroupRows(), []);
  assert.deepEqual(floorGroupRows({ rooms: [{ floor: "3" }], users: undefined }), [
    { floor: "3", roomCount: 1, employeeCount: 0, receptionists: [] },
  ]);
  assert.deepEqual(
    floorGroupRows({ rooms, users, receptionistRoleId: ROLE_IDS.USER })[0].receptionists,
    ["Budi"]
  );
  // A receptionist without a floor never shows up on a floor row.
  assert.deepEqual(floorGroupRows({ rooms, users: [{ name: "Lia", floor: "", role_id: ROLE_IDS.RECEPTIONIST }] }), [
    { floor: "2", roomCount: 2, employeeCount: 0, receptionists: [] },
    { floor: "10", roomCount: 1, employeeCount: 0, receptionists: [] },
  ]);
});

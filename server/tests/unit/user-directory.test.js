import assert from "node:assert/strict";
import { test } from "node:test";
import { directoryEmployee, directoryScope, publicEmployee } from "../../features/users/user.service.js";

const employee = { ...{ name: "Karyawan Uji", email: "emp@uji.local" }, role: "USER" };

test("a non-admin without a search term only reads their own floor", () => {
  assert.deepEqual(directoryScope({ ...employee, floor: "1" }), { scope: "floor", floors: ["1"] });
  assert.deepEqual(directoryScope({ ...employee, floor: " 2 " }), { scope: "floor", floors: ["2"] });
});

test("a non-admin without a work floor gets no directory at all", () => {
  assert.deepEqual(directoryScope({ ...employee, floor: null }), { scope: "none" });
  assert.deepEqual(directoryScope({ ...employee }), { scope: "none" });
  assert.deepEqual(directoryScope({ ...employee, floor: "   " }), { scope: "none" });
  // Without a search term the directory is not dumped either.
  assert.deepEqual(directoryScope({ ...employee, floor: "" }, { q: "" }), { scope: "none" });
});

test("the all floor group lists the whole directory, still limited to minimal fields", () => {
  assert.deepEqual(directoryScope({ ...employee, floor: "all" }), { scope: "floor", floors: null });
  assert.deepEqual(directoryScope({ ...employee, floor: "ALL" }), { scope: "floor", floors: null });
});

test("a search term looks across floors and is capped at twenty rows", () => {
  assert.deepEqual(
    directoryScope({ ...employee, floor: "1" }, { q: "  Harun " }),
    { scope: "search", term: "Harun", limit: 20 }
  );
  // The search ignores the caller's floor on purpose.
  assert.deepEqual(
    directoryScope({ ...employee, floor: null }, { q: "harun" }),
    { scope: "search", term: "harun", limit: 20 }
  );
});

test("a one-character search term is rejected instead of matching everyone", () => {
  assert.throws(
    () => directoryScope({ ...employee, floor: "1" }, { q: "h" }),
    (error) => error.status === 400 && error.code === "INVALID_QUERY"
  );
  assert.throws(
    () => directoryScope({ ...employee, floor: "1" }, { q: " h " }),
    (error) => error.code === "INVALID_QUERY"
  );
});

test("directory rows keep identity fields only, whatever the query returned", () => {
  const row = {
    _id: "1",
    name: "A",
    email: "a@x.test",
    type: "employee",
    username: "a",
    employee_id: "EMP-1",
    card_number: "DEMO-CARD",
    cards: [{ id: "card-1", card_number: "DEMO-CARD", status: "active" }],
    floor: "3",
    is_master_card: true,
  };
  assert.deepEqual(Object.keys(directoryEmployee(row)).sort(), ["_id", "email", "name", "type"]);
  // The older blacklist projection is kept as the second line of defence.
  assert.deepEqual(Object.keys(publicEmployee(row)).sort(), ["_id", "email", "name", "type", "username"]);
});

test("a multi-floor user reads every listed floor", () => {
  assert.deepEqual(
    directoryScope({ ...employee, floors: ["1", "2"] }),
    { scope: "floor", floors: ["1", "2"] }
  );
});

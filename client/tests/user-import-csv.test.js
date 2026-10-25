import assert from "node:assert/strict";
import test from "node:test";
import { parseUserCsv } from "../domain/users/user-import-csv.js";

test("parses quoted CSV fields and normalizes headers", () => {
  const rows = parseUserCsv(
    '\uFEFFemployee_id,Name,email,role,floor,card_number\r\n'
    + 'EMP-001,"Doe, Jane",jane@example.test,user,3,"123,456"\r\n',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employee_id, "EMP-001");
  assert.equal(rows[0].name, "Doe, Jane");
  assert.equal(rows[0].email, "jane@example.test");
  assert.equal(rows[0].card_number, "123,456");
  assert.equal(rows[0].__line, 2);
});

test("requires employee_id, name, and email columns", () => {
  assert.throws(() => parseUserCsv("name,email\nA,a@example.test"), /Missing columns: employee_id/);
  assert.throws(() => parseUserCsv(""), /CSV is empty/);
});

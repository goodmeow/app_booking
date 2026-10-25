import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer } from "../parity/fixtures.js";

let server;
let userRoleId;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  userRoleId = await queryParityDatabase("SELECT _id FROM tbl_role WHERE lower(role_name) = 'user';");
});

after(() => stopServer(server));

const createEmployee = async ({ employeeId, name, email, floor, cardNumber }) => {
  const response = await apiRequest(targets.reconstructed, "/api/users/", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      name,
      email,
      employee_id: employeeId,
      password: "Import123!",
      floor,
      card_number: cardNumber,
      roleId: userRoleId,
    }),
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
};

test("overwrite keeps the existing floor when the CSV has no floor column", async () => {
  await createEmployee({
    employeeId: "IMP-FLOOR",
    name: "Floor Keeper",
    email: "floor.keeper@example.test",
    floor: "3",
    cardNumber: "910000001",
  });

  const response = await apiRequest(targets.reconstructed, "/api/users/import", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      mode: "overwrite",
      rows: [{
        employee_id: "IMP-FLOOR",
        name: "Floor Keeper Updated",
        email: "floor.keeper@example.test",
      }],
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.updated, 1);
  assert.equal(response.body.failed, 0);
  assert.equal(
    await queryParityDatabase("SELECT floor FROM tbl_users WHERE employee_id = 'IMP-FLOOR';"),
    "3"
  );
});

test("a card conflict rolls back the whole overwrite row", async () => {
  await createEmployee({
    employeeId: "IMP-CARD-A",
    name: "Card Owner",
    email: "card.owner@example.test",
    floor: "3",
    cardNumber: "910000002",
  });
  await createEmployee({
    employeeId: "IMP-CARD-B",
    name: "Second Owner",
    email: "second.owner@example.test",
    floor: "3",
    cardNumber: "910000003",
  });

  const response = await apiRequest(targets.reconstructed, "/api/users/import", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      mode: "overwrite",
      rows: [{
        employee_id: "IMP-CARD-B",
        name: "Should Not Persist",
        email: "second.owner@example.test",
        card_number: "910000002",
      }],
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.updated, 0);
  assert.equal(response.body.failed, 1);
  assert.equal(response.body.errors[0].code, "CARD_EXISTS");
  assert.equal(
    await queryParityDatabase("SELECT name FROM tbl_users WHERE employee_id = 'IMP-CARD-B';"),
    "Second Owner"
  );
  assert.equal(
    await queryParityDatabase("SELECT count(*) FROM tbl_user_cards WHERE card_number = '910000002';"),
    "1"
  );
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer } from "../parity/fixtures.js";

let server;
let userRoleId;
let adminRoleId;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  userRoleId = await queryParityDatabase("SELECT _id FROM tbl_role WHERE lower(role_name) = 'user';");
  adminRoleId = await queryParityDatabase("SELECT _id FROM tbl_role WHERE lower(role_name) = 'admin';");
});

after(() => stopServer(server));

const createEmployee = async ({ employeeId, name, email, floor, cardNumber, roleId = userRoleId }) => {
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
      roleId,
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

test("overwrite cannot demote the last active admin", async () => {
  // The parity seed already holds exactly one admin, which is what makes this
  // demotion the forbidden one.
  assert.equal(
    await queryParityDatabase(
      `SELECT count(*) FROM tbl_users
       WHERE role_id = '${adminRoleId}'
         AND is_deleted IS NOT TRUE;`
    ),
    "1"
  );

  const response = await apiRequest(targets.reconstructed, "/api/users/import", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      mode: "overwrite",
      rows: [{
        employee_id: "EMP-ADMIN",
        name: "Test Admin",
        email: "admin@example.test",
        role: "user",
      }],
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.updated, 0);
  assert.equal(response.body.failed, 1);
  assert.equal(response.body.errors[0].code, "LAST_ADMIN");
  assert.equal(response.body.errors[0].message, "Cannot demote the last active admin");
  assert.equal(
    await queryParityDatabase("SELECT role_id FROM tbl_users WHERE employee_id = 'EMP-ADMIN';"),
    adminRoleId
  );
});

test("overwrite may demote an admin while another admin remains", async () => {
  await createEmployee({
    employeeId: "IMP-ADMIN",
    name: "Second Admin",
    email: "second.admin@example.test",
    roleId: adminRoleId,
  });

  const response = await apiRequest(targets.reconstructed, "/api/users/import", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      mode: "overwrite",
      rows: [{
        employee_id: "IMP-ADMIN",
        name: "Second Admin",
        email: "second.admin@example.test",
        role: "user",
      }],
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.updated, 1);
  assert.equal(response.body.failed, 0);
  assert.equal(
    await queryParityDatabase("SELECT role_id FROM tbl_users WHERE employee_id = 'IMP-ADMIN';"),
    userRoleId
  );
});

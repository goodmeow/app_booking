import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

let server;
let userRoleId;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  userRoleId = await queryParityDatabase("SELECT _id FROM tbl_role WHERE lower(role_name) = 'user';");
  // The parity seed leaves employee floors empty; the directory tests below
  // need two colleagues on different floors.
  await queryParityDatabase(`
    UPDATE tbl_users SET floor = '1' WHERE _id = '${identities.user._id}';
    UPDATE tbl_users SET floor = '2' WHERE _id = '${identities.viewer._id}';
  `);
});

after(() => stopServer(server));

test("admin keeps the employee card in the user list and can flag it as master", async () => {
  const created = await apiRequest(targets.reconstructed, "/api/users/", {
    method: "POST",
    headers: bearer("admin"),
    body: JSON.stringify({
      name: "Card Officer",
      email: "card.officer@example.test",
      username: "card-officer",
      password: "Petugas123!",
      card_number: "555000111",
      master_card: true,
      roleId: userRoleId,
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.card_number, "555000111");
  assert.equal(created.body.is_master_card, true);
  assert.equal(
    await queryParityDatabase("SELECT count(*) FROM tbl_card_masters WHERE card_number = '555000111';"),
    "1"
  );

  const listed = await apiRequest(targets.reconstructed, "/api/users/", { headers: bearer("admin") });
  assert.equal(listed.status, 200);
  const row = listed.body.find((user) => user.email === "card.officer@example.test");
  assert.equal(row.card_number, "555000111");
  assert.equal(row.is_master_card, true);

  const unflagged = await apiRequest(targets.reconstructed, `/api/users/${created.body._id}`, {
    method: "PUT",
    headers: bearer("admin"),
    body: JSON.stringify({ card_number: "555000111", master_card: false }),
  });
  assert.equal(unflagged.status, 200);
  assert.equal(unflagged.body.is_master_card, false);
  assert.equal(
    await queryParityDatabase("SELECT count(*) FROM tbl_card_masters WHERE card_number = '555000111';"),
    "0"
  );
});

test("a non-admin cannot flag a card as master", async () => {
  const response = await apiRequest(targets.reconstructed, `/api/users/${"20000000-0000-4000-8000-000000000002"}`, {
    method: "PUT",
    headers: bearer("user"),
    body: JSON.stringify({ card_number: "TEST-USER-CARD", master_card: true }),
  });
  assert.equal(response.status, 200);
  const flagged = await queryParityDatabase("SELECT count(*) FROM tbl_card_masters WHERE card_number = 'TEST-USER-CARD';");
  assert.equal(flagged, "0");
});

const directoryKeys = ["_id", "email", "name", "type"];

test("a non-admin only sees colleagues from their own floor, without card data", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/users", { headers: bearer("user") });
  assert.equal(response.status, 200);

  const colleagueNames = await queryParityDatabase(`
    SELECT string_agg(name, ',' ORDER BY name)
    FROM tbl_users
    WHERE type = 'employee'
      AND is_deleted IS NOT TRUE
      AND floor = '1';
  `);
  assert.equal(response.body.map((row) => row.name).join(","), colleagueNames);
  // The colleague on floor 2 stays out of the floor-1 list.
  assert.equal(response.body.some((row) => row.email === identities.viewer.email), false);

  for (const row of response.body) {
    assert.deepEqual(Object.keys(row).sort(), directoryKeys);
  }
});

test("a non-admin search finds a colleague from another floor with minimal fields", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/users?q=viewer", { headers: bearer("user") });
  assert.equal(response.status, 200);

  const found = response.body.find((row) => row.email === identities.viewer.email);
  assert.ok(found, "the floor-2 colleague must be reachable through the search");
  for (const row of response.body) {
    assert.deepEqual(Object.keys(row).sort(), directoryKeys);
  }
});

test("a non-admin search stops at twenty rows", async () => {
  await queryParityDatabase(`
    INSERT INTO tbl_users (name, email, type, floor, role_id, is_deleted)
    SELECT
      'Directory Member ' || n,
      'directory.' || n || '@example.test',
      'employee',
      '3',
      '${userRoleId}',
      false
    FROM generate_series(1, 25) AS n;
  `);

  const response = await apiRequest(targets.reconstructed, "/api/users?q=directory", { headers: bearer("user") });
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 20);
  for (const row of response.body) {
    assert.deepEqual(Object.keys(row).sort(), directoryKeys);
  }
});

test("a one-character search term is rejected for non-admins", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/users?q=h", { headers: bearer("user") });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_QUERY");
});

test("an admin keeps the full list and ignores the search term", async () => {
  const plain = await apiRequest(targets.reconstructed, "/api/users", { headers: bearer("admin") });
  const searched = await apiRequest(targets.reconstructed, "/api/users?q=card.officer", { headers: bearer("admin") });
  assert.equal(plain.status, 200);
  assert.equal(searched.status, 200);
  assert.deepEqual(searched.body, plain.body);

  const officer = plain.body.find((row) => row.email === "card.officer@example.test");
  assert.equal(officer.card_number, "555000111");
  assert.ok(Object.hasOwn(officer, "floor"));
  assert.ok(Object.hasOwn(officer, "is_master_card"));
});

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

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

// End-to-end coverage for the employee ID rule and the card model:
// one employee ID per user (case-insensitive) and at most two active cards,
// where a reported-lost card stays as a record and stops working.

const USER_ROLE_ID = "67e9500b-908a-497d-9d3b-54bc020700cb";

let server;
let kioskToken;
let holder;
let other;
let holderCards = [];

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
  kioskToken = (await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identities.room.email, password: "RoomTablet123!", deviceName: "Card Model Tablet" }),
  })).body.token;
});

after(async () => stopServer(server));

const createEmployee = (body) => apiRequest(targets.reconstructed, "/api/users", {
  method: "POST",
  headers: bearer("admin"),
  body: JSON.stringify({
    name: "Card Holder",
    email: "card.holder@example.test",
    password: "Password123!",
    roleId: USER_ROLE_ID,
    ...body,
  }),
});

const addCard = (userId, cardNumber, token = "admin") => apiRequest(
  targets.reconstructed,
  `/api/users/${userId}/cards`,
  {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({ card_number: cardNumber }),
  }
);

const markLost = (userId, cardId, token = "admin") => apiRequest(
  targets.reconstructed,
  `/api/users/${userId}/cards/${cardId}`,
  {
    method: "PATCH",
    headers: bearer(token),
    body: JSON.stringify({ status: "lost" }),
  }
);

const reactivate = (userId, cardId, token = "admin") => apiRequest(
  targets.reconstructed,
  `/api/users/${userId}/cards/${cardId}`,
  {
    method: "PATCH",
    headers: bearer(token),
    body: JSON.stringify({ status: "active" }),
  }
);

const doorOpen = (cardNumber) => apiRequest(targets.reconstructed, "/api/kiosk/door-open", {
  method: "POST",
  headers: { Authorization: `Bearer ${kioskToken}`, "Content-Type": "application/json" },
  body: JSON.stringify({ card_number: cardNumber }),
});

test("creating a user requires an employee ID", async () => {
  const missing = await createEmployee({ email: "no.employee.id@example.test" });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, "INVALID_EMPLOYEE_ID");

  const malformed = await createEmployee({ employee_id: "EMP 001", email: "bad.employee.id@example.test" });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.code, "INVALID_EMPLOYEE_ID");

  const tooLong = await createEmployee({ employee_id: "E".repeat(41), email: "long.employee.id@example.test" });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.code, "INVALID_EMPLOYEE_ID");
});

test("an employee ID is unique regardless of letter case", async () => {
  const created = await createEmployee({ employee_id: "EMP-CARD-HOLDER" });
  assert.equal(created.status, 201);
  assert.equal(created.body.employee_id, "EMP-CARD-HOLDER");
  assert.deepEqual(created.body.cards, []);
  holder = created.body;

  const duplicate = await createEmployee({ employee_id: " emp-card-holder ", email: "other.holder@example.test" });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "EMPLOYEE_ID_EXISTS");

  const duplicateEmail = await createEmployee({ employee_id: "EMP-OTHER-HOLDER", email: "second.holder@example.test" });
  assert.equal(duplicateEmail.status, 201);
  other = duplicateEmail.body;
});

test("a user can hold two active cards, the third is rejected", async () => {
  const first = await addCard(holder._id, "DEMO-CARD-ALPHA");
  assert.equal(first.status, 201);
  assert.equal(first.body.card_number, "DEMO-CARD-ALPHA");
  assert.equal(first.body.status, "active");

  const second = await addCard(holder._id, "DEMO-CARD-BETA");
  assert.equal(second.status, 201);

  const third = await addCard(holder._id, "DEMO-CARD-GAMMA");
  assert.equal(third.status, 409);
  assert.equal(third.body.code, "CARD_LIMIT");

  // A card belongs to one user only, whatever the case.
  const stolen = await addCard(other._id, "demo-card-beta");
  assert.equal(stolen.status, 409);
  assert.equal(stolen.body.code, "CARD_EXISTS");

  holderCards = [first.body, second.body];
});

test("a lost card keeps its record and stops opening the door", async () => {
  const active = await doorOpen("DEMO-CARD-ALPHA");
  assert.equal(active.status, 200);

  const lost = await markLost(holder._id, holderCards[0].id);
  assert.equal(lost.status, 200);
  assert.equal(lost.body.status, "lost");
  assert.ok(lost.body.lost_at, "lost_at must be filled in");

  const rejected = await doorOpen("DEMO-CARD-ALPHA");
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.code, "INVALID_CARD");

  // The remaining active card still works; only the reported one is dead.
  const stillActive = await doorOpen("DEMO-CARD-BETA");
  assert.equal(stillActive.status, 200);

  // Reporting the same card twice is a conflict, not a silent no-op.
  const twice = await markLost(holder._id, holderCards[0].id);
  assert.equal(twice.status, 409);
  assert.equal(twice.body.code, "CARD_ALREADY_LOST");

  // A found card can be switched back on: the same row becomes active again and
  // the door master list is restored.
  const restored = await reactivate(holder._id, holderCards[0].id);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.status, "active");
  assert.equal(restored.body.lost_at, null);
  assert.equal((await doorOpen("DEMO-CARD-ALPHA")).status, 200);

  const restoredTwice = await reactivate(holder._id, holderCards[0].id);
  assert.equal(restoredTwice.status, 409);
  assert.equal(restoredTwice.body.code, "CARD_ALREADY_ACTIVE");

  // Return to the lost state so the replacement test starts from one free slot.
  const lostAgain = await markLost(holder._id, holderCards[0].id);
  assert.equal(lostAgain.status, 200);
  assert.equal((await doorOpen("DEMO-CARD-ALPHA")).status, 400);
});

test("a lost card frees a slot for the replacement card", async () => {
  const replacement = await addCard(holder._id, "DEMO-CARD-DELTA");
  assert.equal(replacement.status, 201);
  assert.equal(replacement.body.status, "active");
});

test("reactivation is refused while both active slots are full", async () => {
  // BETA + DELTA are active here, so the lost ALPHA cannot be restored yet.
  const blocked = await reactivate(holder._id, holderCards[0].id);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "CARD_LIMIT");
});

test("the user detail keeps lost cards and hides the employee ID from non-admins", async () => {
  const admin = await apiRequest(targets.reconstructed, `/api/users/${holder._id}`, { headers: bearer("admin") });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.employee_id, "EMP-CARD-HOLDER");
  assert.equal(admin.body.cards.length, 3);
  const lostCards = admin.body.cards.filter((card) => card.status === "lost");
  assert.equal(lostCards.length, 1);
  assert.equal(lostCards[0].card_number, "DEMO-CARD-ALPHA");
  assert.ok(lostCards[0].lost_at);

  // An employee still sees their own cards but never the employee ID field.
  const self = await apiRequest(targets.reconstructed, `/api/users/${identities.user._id}`, { headers: bearer("user") });
  assert.equal(self.status, 200);
  assert.ok(Array.isArray(self.body.cards));
  assert.equal(Object.hasOwn(self.body, "employee_id"), false);
});

test("only admins may change cards", async () => {
  const forbiddenCreate = await addCard(identities.user._id, "DEMO-CARD-SELF", "user");
  assert.equal(forbiddenCreate.status, 403);

  const forbiddenLost = await markLost(holder._id, holderCards[0].id, "user");
  assert.equal(forbiddenLost.status, 403);

  const forbiddenActive = await reactivate(holder._id, holderCards[0].id, "user");
  assert.equal(forbiddenActive.status, 403);

  const wrongStatus = await apiRequest(
    targets.reconstructed,
    `/api/users/${holder._id}/cards/${holderCards[0].id}`,
    {
      method: "PATCH",
      headers: bearer("admin"),
      body: JSON.stringify({ status: "stolen" }),
    }
  );
  assert.equal(wrongStatus.status, 400);
  assert.equal(wrongStatus.body.code, "INVALID_CARD_STATUS");
});

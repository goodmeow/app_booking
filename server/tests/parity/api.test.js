import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "./harness.js";
import { bearer, ids, identities } from "./fixtures.js";

const protectedRoutes = [
  ["POST", "/api/door-open"],
  ["GET", "/api/events"],
  ["POST", "/api/events"],
  ["PUT", "/api/events"],
  ["POST", "/api/events/attendee"],
  ["PUT", "/api/events/delete"],
  ["GET", "/api/events/details"],
  ["DELETE", "/api/events/details"],
  ["PUT", "/api/events/check-in"],
  ["PUT", "/api/events/early-finish"],
  ["GET", "/api/users"],
  ["POST", "/api/users"],
  ["PUT", "/api/users/change-password"],
  ["GET", `/api/users/${identities.admin._id}`],
  ["PUT", `/api/users/${identities.admin._id}`],
  ["DELETE", `/api/users/${identities.admin._id}`],
  ["GET", "/api/rooms"],
  ["POST", "/api/rooms"],
  ["GET", "/api/rooms/available"],
  ["GET", "/api/rooms/usage-report"],
  ["GET", `/api/rooms/${identities.room._id}`],
  ["PUT", `/api/rooms/${identities.room._id}`],
  ["DELETE", `/api/rooms/${identities.room._id}`],
  ["GET", "/api/settings"],
  ["PUT", "/api/settings"],
  ["GET", "/api/settings/card-master"],
  ["POST", "/api/settings/card-master"],
  ["PUT", `/api/settings/card-master/${ids.masterCard}`],
  ["DELETE", `/api/settings/card-master/${ids.masterCard}`],
];

let legacy;
let reconstructed;

before(async () => {
  await resetParityDatabase();
  legacy = await startServer(targets.legacy);
  reconstructed = await startServer(targets.reconstructed);
});

after(async () => Promise.all([stopServer(legacy), stopServer(reconstructed)]));

test("all recovered routes retain public versus authenticated boundaries", async () => {
  for (const target of Object.values(targets)) {
    assert.equal((await apiRequest(target, "/api/auth/signout")).status, 200);
    assert.equal((await apiRequest(target, "/api/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    for (const [method, pathname] of protectedRoutes) {
      assert.equal((await apiRequest(target, pathname, { method })).status, 401, `${target.name} ${method} ${pathname}`);
    }
  }
});

test("authentication remains usable while hardened payload omits secrets", async () => {
  for (const target of Object.values(targets)) {
    const response = await apiRequest(target, "/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: identities.admin.email, password: "ParityTest123!" }),
    });
    assert.equal(response.status, 200);
    assert.ok(response.body.token);
    assert.equal(response.body.user._id, identities.admin._id);
    assert.equal(Object.hasOwn(response.body.user, "password"), false);
  }
});

test("stable read endpoints remain available after modularization", async () => {
  const cases = [
    ["/api/rooms", "user", Array.isArray],
    [`/api/rooms/${identities.room._id}`, "user", (value) => value?._id === identities.room._id],
    ["/api/users", "user", Array.isArray],
    ["/api/settings", "user", (value) => value?._id === ids.settings],
    ["/api/settings/card-master", "admin", Array.isArray],
    [`/api/events/details?event_id=${ids.event}`, "admin", Array.isArray],
    ["/api/rooms/usage-report?start=2030-01-01&end=2030-01-31", "admin", Array.isArray],
  ];
  for (const [pathname, role, check] of cases) {
    const response = await apiRequest(targets.reconstructed, pathname, { headers: bearer(role) });
    assert.equal(response.status, 200, pathname);
    assert.ok(check(response.body), pathname);
  }
});

test("intentional Phase 9 authorization divergence is enforced", async () => {
  const settings = await apiRequest(targets.reconstructed, "/api/settings", {
    method: "PUT",
    headers: bearer("user"),
    body: JSON.stringify({ id: ids.settings }),
  });
  assert.equal(settings.status, 403);

  const otherProfile = await apiRequest(targets.reconstructed, `/api/users/${identities.admin._id}`, {
    headers: bearer("user"),
  });
  assert.equal(otherProfile.status, 403);
});

test("master-card door integration remains available", async () => {
  const response = await apiRequest(targets.reconstructed, "/api/door-open", {
    method: "POST",
    headers: bearer("user"),
    body: JSON.stringify({ card_number: "TEST-MASTER-CARD" }),
  });
  assert.equal(response.status, 200);
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  apiRequest,
  normalizeDynamic,
  queryParityDatabase,
  resetParityDatabase,
  startServer,
  stopServer,
  targets,
  withIsolatedTarget,
} from "./harness.js";
import { bearer, ids } from "./fixtures.js";

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
  ["GET", "/api/users/20000000-0000-4000-8000-000000000001"],
  ["PUT", "/api/users/20000000-0000-4000-8000-000000000001"],
  ["DELETE", "/api/users/20000000-0000-4000-8000-000000000001"],
  ["GET", "/api/rooms"],
  ["POST", "/api/rooms"],
  ["GET", "/api/rooms/available"],
  ["GET", "/api/rooms/usage-report"],
  ["GET", "/api/rooms/30000000-0000-4000-8000-000000000001"],
  ["PUT", "/api/rooms/30000000-0000-4000-8000-000000000001"],
  ["DELETE", "/api/rooms/30000000-0000-4000-8000-000000000001"],
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

after(async () => {
  await Promise.all([stopServer(legacy), stopServer(reconstructed)]);
});

test("all 32 routes exist with matching public/JWT boundaries", async () => {
  for (const target of Object.values(targets)) {
    const signout = await apiRequest(target, "/api/auth/signout");
    assert.equal(signout.status, 200, `${target.name} signout`);

    const signin = await apiRequest(target, "/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(signin.status, 401, `${target.name} signin`);

    const signup = await apiRequest(target, "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(signup.status, 400, `${target.name} signup`);

    for (const [method, pathname] of protectedRoutes) {
      const response = await apiRequest(target, pathname, { method });
      assert.equal(response.status, 401, `${target.name} ${method} ${pathname}`);
    }
  }
});

test("public authentication contracts match", async () => {
  const results = [];
  for (const target of Object.values(targets)) {
    const response = await apiRequest(target, "/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.test",
        password: "ParityTest123!",
      }),
    });
    assert.equal(response.status, 200);
    assert.match(response.setCookie || "", /^t=/);
    results.push(normalizeDynamic(response.body));
  }
  assert.deepEqual(results[0], results[1]);
});

test("read-only API payloads match", async () => {
  const cases = [
    ["/api/users", "admin"],
    ["/api/rooms", "user"],
    [`/api/rooms/30000000-0000-4000-8000-000000000001`, "user"],
    ["/api/settings", "user"],
    ["/api/settings/card-master", "user"],
    [`/api/events/details?event_id=${ids.event}`, "user"],
    ["/api/rooms/usage-report?start=2030-01-01&end=2030-01-31", "admin"],
  ];

  for (const [pathname, role] of cases) {
    const responses = [];
    for (const target of Object.values(targets)) {
      responses.push(
        await apiRequest(target, pathname, { headers: bearer(role) })
      );
    }
    assert.equal(responses[0].status, responses[1].status, pathname);
    assert.deepEqual(
      normalizeDynamic(responses[0].body),
      normalizeDynamic(responses[1].body),
      pathname
    );
  }
});

async function settingsScenario(target) {
  const response = await apiRequest(target, "/api/settings", {
    method: "PUT",
    headers: bearer("user"),
    body: JSON.stringify({
      id: ids.settings,
      lock_timer: 6,
      led_timer: 7,
      table_input: false,
      not_checked_in_time_limit: 20,
      time_of_event_start_soon: 12,
      available_color: "05",
      will_start_color: "08",
      on_meeting_color: "04",
    }),
  });
  const database = await queryParityDatabase(
    "SELECT lock_timer || '|' || led_timer || '|' || table_input " +
      `FROM tbl_app_settings WHERE _id = '${ids.settings}';`
  );
  return { response, database };
}

test("authenticated non-admin settings mutation matches", async () => {
  await Promise.all([stopServer(legacy), stopServer(reconstructed)]);
  legacy = null;
  reconstructed = null;

  const oldResult = await withIsolatedTarget(targets.legacy, settingsScenario);
  const newResult = await withIsolatedTarget(targets.reconstructed, settingsScenario);
  assert.deepEqual(oldResult, newResult);
});

test("master-card door validation matches", async () => {
  const scenario = (target) =>
    apiRequest(target, "/api/door-open", {
      method: "POST",
      headers: bearer("user"),
      body: JSON.stringify({ card_number: "TEST-MASTER-CARD" }),
    });

  const oldResult = await withIsolatedTarget(targets.legacy, scenario);
  const newResult = await withIsolatedTarget(targets.reconstructed, scenario);
  assert.deepEqual(oldResult, newResult);
});

test("authorization behavior matches for self/other/admin boundaries", async () => {
  const cases = [
    [
      "GET",
      "/api/users/20000000-0000-4000-8000-000000000001",
      "user",
      200,
    ],
    ["POST", "/api/rooms", "user", 403],
    ["GET", "/api/rooms/usage-report?start=2030-01-01&end=2030-01-31", "user", 403],
  ];

  for (const [method, pathname, role, status] of cases) {
    const scenario = (target) =>
      apiRequest(target, pathname, { method, headers: bearer(role) });
    const oldResult = await withIsolatedTarget(targets.legacy, scenario);
    const newResult = await withIsolatedTarget(targets.reconstructed, scenario);
    assert.equal(oldResult.status, status);
    assert.deepEqual(
      normalizeDynamic(oldResult),
      normalizeDynamic(newResult),
      `${method} ${pathname}`
    );
  }
});

async function eventMutationScenario(target, action) {
  const definitions = {
    checkIn: {
      pathname: "/api/events/check-in",
      role: "user",
      body: { event_id: ids.event, card_number: "TEST-MASTER-CARD" },
      snapshot: `SELECT checked_in IS NOT NULL FROM tbl_events WHERE _id = '${ids.event}';`,
    },
    earlyFinish: {
      pathname: "/api/events/early-finish",
      role: "admin",
      body: { event_id: ids.event },
      snapshot: `SELECT end_date < '2030-01-15 11:00:00' FROM tbl_events WHERE _id = '${ids.event}';`,
    },
    cancel: {
      pathname: `/api/events/delete?event_id=${ids.event}`,
      role: "admin",
      body: null,
      snapshot: `SELECT is_cancel FROM tbl_events WHERE _id = '${ids.event}';`,
    },
  };
  const definition = definitions[action];
  const response = await apiRequest(target, definition.pathname, {
    method: "PUT",
    headers: bearer(definition.role),
    body: definition.body ? JSON.stringify(definition.body) : undefined,
  });
  const database = await queryParityDatabase(definition.snapshot);
  return { response: normalizeDynamic(response), database };
}

for (const action of ["checkIn", "earlyFinish", "cancel"]) {
  test(`event ${action} response and database mutation match`, async () => {
    const oldResult = await withIsolatedTarget(targets.legacy, (target) =>
      eventMutationScenario(target, action)
    );
    const newResult = await withIsolatedTarget(targets.reconstructed, (target) =>
      eventMutationScenario(target, action)
    );
    assert.equal(oldResult.response.status, 200);
    assert.equal(oldResult.database, "t");
    assert.deepEqual(oldResult, newResult);
  });
}

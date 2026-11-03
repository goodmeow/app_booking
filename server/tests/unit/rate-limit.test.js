import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
  createMemoryStore,
  failedLoginRateLimits,
  fixedWindowRateLimit,
  ipAndLoginKey,
} from "../../security/rate-limit.middleware.js";

const request = (ip, body = {}) => ({ ip, body, socket: { remoteAddress: ip } });
const response = () => Object.assign(new EventEmitter(), {
  statusCode: 200,
  headers: {},
  set(name, value) { this.headers[name] = value; },
});

// Runs all limiters like Express middleware, then ends the response with a
// given status so the effect of skipSuccessfulRequests is tested too.
const attempt = async (limiters, req, statusCode) => {
  const res = response();
  let blocked = null;
  for (const limiter of limiters) {
    blocked = await new Promise((resolve) => {
      limiter(req, res, (error) => resolve(error || null));
    });
    if (blocked) break;
  }
  res.statusCode = statusCode;
  res.emit("finish");
  // The quota refund runs after "finish"; let its promise settle.
  await new Promise((resolve) => setImmediate(resolve));
  return blocked;
};

test("successful logins from a shared address are never limited", async () => {
  const store = createMemoryStore();
  const limiters = failedLoginRateLimits({ scope: "test:signin", store, perAccount: 3, perAddress: 5 });
  for (let user = 0; user < 40; user += 1) {
    assert.equal(await attempt(limiters, request("10.0.0.1", { email: `user${user}@example.test` }), 200), null);
  }
});

test("repeated failed attempts against one account are limited", async () => {
  const store = createMemoryStore();
  const limiters = failedLoginRateLimits({ scope: "test:signin", store, perAccount: 3, perAddress: 100 });
  for (let index = 0; index < 3; index += 1) {
    assert.equal(await attempt(limiters, request("10.0.0.2", { email: "Victim@Example.test" }), 401), null);
  }
  const blocked = await attempt(limiters, request("10.0.0.2", { email: "victim@example.test" }), 401);
  assert.equal(blocked?.status, 429);
  assert.equal(await attempt(limiters, request("10.0.0.2", { email: "someone-else@example.test" }), 200), null);
});

test("one address trying many accounts is limited by the address limiter", async () => {
  const store = createMemoryStore();
  const limiters = failedLoginRateLimits({ scope: "test:signin", store, perAccount: 10, perAddress: 5 });
  let blocked = null;
  for (let user = 0; user < 6; user += 1) {
    blocked = await attempt(limiters, request("10.0.0.3", { email: `u${user}@example.test` }), 401);
  }
  assert.equal(blocked?.status, 429);
});

test("a successful attempt gives its quota back within the window", async () => {
  const limiter = fixedWindowRateLimit({
    scope: "test:refund",
    store: createMemoryStore(),
    windowMs: 60_000,
    max: 2,
    skipSuccessfulRequests: true,
  });
  assert.equal(await attempt([limiter], request("10.0.0.4"), 200), null);
  assert.equal(await attempt([limiter], request("10.0.0.4"), 200), null);
  assert.equal(await attempt([limiter], request("10.0.0.4"), 401), null);
  assert.equal(await attempt([limiter], request("10.0.0.4"), 401), null);
  assert.equal((await attempt([limiter], request("10.0.0.4"), 401))?.status, 429);
});

test("counting every request still works when successes are not skipped", async () => {
  const limiter = fixedWindowRateLimit({
    scope: "test:every-request",
    store: createMemoryStore(),
    windowMs: 60_000,
    max: 1,
  });
  assert.equal(await attempt([limiter], request("10.0.0.5"), 200), null);
  assert.equal((await attempt([limiter], request("10.0.0.5"), 200))?.status, 429);
});

// The audit finding: two processes used to keep separate counters and therefore
// allowed max twice. Sharing one store and one scope must yield one budget.
test("two limiters on one shared store enforce a single combined limit", async () => {
  const store = createMemoryStore();
  const options = { scope: "test:shared", store, windowMs: 60_000, max: 2 };
  const firstProcess = fixedWindowRateLimit(options);
  const secondProcess = fixedWindowRateLimit(options);

  assert.equal(await attempt([firstProcess], request("10.0.0.8"), 200), null);
  assert.equal(await attempt([firstProcess], request("10.0.0.8"), 200), null);
  assert.equal((await attempt([secondProcess], request("10.0.0.8"), 200))?.status, 429);
});

test("a failing store lets the request through instead of taking the API down", async () => {
  const brokenStore = {
    hit: async () => { throw new Error("store unavailable"); },
  };
  const limiter = fixedWindowRateLimit({ scope: "test:fail-open", store: brokenStore, windowMs: 60_000, max: 1 });

  assert.equal(await attempt([limiter], request("10.0.0.9"), 200), null);
  assert.equal(await attempt([limiter], request("10.0.0.9"), 200), null);
});

test("the account key stays safe when the body is not an object", () => {
  assert.equal(ipAndLoginKey({ ip: "10.0.0.6", body: "text" }), "10.0.0.6|");
  assert.equal(ipAndLoginKey({ ip: "10.0.0.6", body: null }), "10.0.0.6|");
});

test("the email in the account key is normalised", () => {
  assert.equal(ipAndLoginKey({ ip: "10.0.0.7", body: { email: " User@Example.test " } }), "10.0.0.7|user@example.test");
});

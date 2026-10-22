import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { failedLoginRateLimits, fixedWindowRateLimit, ipAndLoginKey } from "../../security/rate-limit.middleware.js";

const request = (ip, body = {}) => ({ ip, body, socket: { remoteAddress: ip } });
const response = () => Object.assign(new EventEmitter(), {
  statusCode: 200,
  headers: {},
  set(name, value) { this.headers[name] = value; },
});

// Menjalankan semua limiter seperti middleware Express, lalu menutup respons
// dengan status tertentu supaya efek skipSuccessfulRequests ikut teruji.
const attempt = (limiters, req, statusCode) => {
  const res = response();
  let blocked = null;
  for (const limiter of limiters) {
    let passed = false;
    limiter(req, res, (error) => { if (error) blocked = error; else passed = true; });
    if (!passed) break;
  }
  res.statusCode = statusCode;
  res.emit("finish");
  return blocked;
};

test("login berhasil dari alamat bersama tidak pernah kena limit", () => {
  const limiters = failedLoginRateLimits({ perAccount: 3, perAddress: 5 });
  for (let user = 0; user < 40; user += 1) {
    assert.equal(attempt(limiters, request("10.0.0.1", { email: `user${user}@example.test` }), 200), null);
  }
});

test("percobaan gagal berulang ke satu akun dibatasi", () => {
  const limiters = failedLoginRateLimits({ perAccount: 3, perAddress: 100 });
  for (let index = 0; index < 3; index += 1) {
    assert.equal(attempt(limiters, request("10.0.0.2", { email: "Victim@Example.test" }), 401), null);
  }
  const blocked = attempt(limiters, request("10.0.0.2", { email: "victim@example.test" }), 401);
  assert.equal(blocked?.status, 429);
  assert.equal(attempt(limiters, request("10.0.0.2", { email: "someone-else@example.test" }), 200), null);
});

test("satu alamat yang mencoba banyak akun dibatasi limiter alamat", () => {
  const limiters = failedLoginRateLimits({ perAccount: 10, perAddress: 5 });
  let blocked = null;
  for (let user = 0; user < 6; user += 1) {
    blocked = attempt(limiters, request("10.0.0.3", { email: `u${user}@example.test` }), 401);
  }
  assert.equal(blocked?.status, 429);
});

test("percobaan berhasil mengembalikan jatahnya di dalam jendela", () => {
  const limiter = fixedWindowRateLimit({ windowMs: 60_000, max: 2, skipSuccessfulRequests: true });
  assert.equal(attempt([limiter], request("10.0.0.4"), 200), null);
  assert.equal(attempt([limiter], request("10.0.0.4"), 200), null);
  assert.equal(attempt([limiter], request("10.0.0.4"), 401), null);
  assert.equal(attempt([limiter], request("10.0.0.4"), 401), null);
  assert.equal(attempt([limiter], request("10.0.0.4"), 401)?.status, 429);
});

test("menghitung semua request tetap jalan kalau sukses tidak dilewati", () => {
  const limiter = fixedWindowRateLimit({ windowMs: 60_000, max: 1 });
  assert.equal(attempt([limiter], request("10.0.0.5"), 200), null);
  assert.equal(attempt([limiter], request("10.0.0.5"), 200)?.status, 429);
});

test("kunci akun tetap aman saat body bukan objek", () => {
  assert.equal(ipAndLoginKey({ ip: "10.0.0.6", body: "text" }), "10.0.0.6|");
  assert.equal(ipAndLoginKey({ ip: "10.0.0.6", body: null }), "10.0.0.6|");
});

test("email pada kunci akun dinormalisasi", () => {
  assert.equal(ipAndLoginKey({ ip: "10.0.0.7", body: { email: " User@Example.test " } }), "10.0.0.7|user@example.test");
});

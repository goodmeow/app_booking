import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { authenticateKiosk, fetchKioskSchedule, openKioskDoor, refreshKioskSession } from "../kiosk/kiosk-api.js";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("kiosk schedule contract sends token and date range without caller room identity", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [] };
  };
  await fetchKioskSchedule("kiosk-token", { start: "20310510", end: "20310510" });
  assert.equal(request.url, "/api/kiosk/schedule?start=20310510&end=20310510");
  assert.equal(request.options.headers.Authorization, "Bearer kiosk-token");
  assert.equal(request.url.includes("room"), false);
});

test("kiosk provisioning and refresh send managed device credentials", async () => {
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ token: "next" }) };
  };
  await authenticateKiosk({ email: "room@example.test", password: "secret", deviceName: "North tablet" });
  await refreshKioskSession("opaque-refresh");
  assert.deepEqual(requests, [
    { url: "/api/kiosk/auth", body: { email: "room@example.test", password: "secret", deviceName: "North tablet" } },
    { url: "/api/kiosk/refresh", body: { refreshToken: "opaque-refresh" } },
  ]);
});

test("kiosk door request carries the card and never the caller room identity", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ message: "Door opened" }) };
  };
  await openKioskDoor("kiosk-token", "123456789");
  assert.equal(request.url, "/api/kiosk/door-open");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer kiosk-token");
  assert.deepEqual(JSON.parse(request.options.body), { card_number: "123456789" });
});

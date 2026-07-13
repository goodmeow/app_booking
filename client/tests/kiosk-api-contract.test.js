import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchKioskSchedule } from "../kiosk/kiosk-api.js";

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

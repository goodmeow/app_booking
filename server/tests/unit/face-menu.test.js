import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import config from "../../../config/config.js";
import { filterUnavailableMenus } from "../../features/access/menu-access.controller.js";
import {
  clearFaceProbeCache,
  fetchFaceTemplates,
  probeFaceService,
} from "../../features/face/face.client.js";

const originalUrl = config.faceServiceUrl;
const originalToken = config.faceInternalToken;

let server;
let baseUrl;
let healthHits = 0;
let lastToken = null;

before(async () => {
  server = createServer((req, res) => {
    if (req.url.startsWith("/health")) {
      healthHits += 1;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, model_version: "sface-test", templates: 7, threshold: 0.6, margin: 0.05 }));
      return;
    }
    if (req.url.startsWith("/templates")) {
      lastToken = req.headers["x-face-token"] || null;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ templates: [{ employee_id: "90211" }], total: 1 }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  config.faceServiceUrl = originalUrl;
  config.faceInternalToken = originalToken;
  clearFaceProbeCache();
  await new Promise((resolve) => server.close(resolve));
});

test("an unconfigured face service reports unavailable without throwing", async () => {
  config.faceServiceUrl = "";
  clearFaceProbeCache();
  const status = await probeFaceService();
  assert.deepEqual(status, { available: false });
});

test("a dead face service reports unavailable, not an error", async () => {
  config.faceServiceUrl = "http://127.0.0.1:1";
  clearFaceProbeCache();
  const status = await probeFaceService();
  assert.equal(status.available, false);
});

test("health is cached so /access/menus does not probe on every request", async () => {
  config.faceServiceUrl = baseUrl;
  clearFaceProbeCache();
  healthHits = 0;

  const first = await probeFaceService();
  const second = await probeFaceService();

  assert.equal(first.available, true);
  assert.equal(first.model_version, "sface-test");
  assert.equal(first.templates, 7);
  assert.deepEqual(second, first);
  assert.equal(healthHits, 1);

  clearFaceProbeCache();
  await probeFaceService();
  assert.equal(healthHits, 2);
});

test("reading templates sends the internal token", async () => {
  config.faceServiceUrl = baseUrl;
  config.faceInternalToken = "secret-for-test";
  const listing = await fetchFaceTemplates({ limit: 10, offset: 0 });
  assert.equal(listing.total, 1);
  assert.equal(listing.templates[0].employee_id, "90211");
  assert.equal(lastToken, "secret-for-test");
});

test("the face menu disappears only when the service is unavailable", () => {
  const menus = ["users", "face", "settings"];
  assert.deepEqual(filterUnavailableMenus(menus, false), ["users", "settings"]);
  assert.deepEqual(filterUnavailableMenus(menus, true), menus);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import config, { validateRuntimeConfig } from "../../../config/config.js";
import { buildOccurrences } from "../../features/events/recurrence.service.js";
import { parseInstant } from "../../features/events/event-time.js";
import { createHttpServer } from "../../runtime/create-http-server.js";
import { log } from "../../observability/logger.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("weekly recurrence is deterministic and includes the end date", () => {
  const result = buildOccurrences({
    start: "2031-04-01T02:00:00.000Z",
    end: "2031-04-01T03:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: { cadence: "weekly", interval: 1, weekdays: [2, 4], endDate: "2031-04-10" },
  });

  assert.deepEqual(result.occurrences.map((item) => item.localDate), [
    "2031-04-01",
    "2031-04-03",
    "2031-04-08",
    "2031-04-10",
  ]);
  assert.deepEqual(result.occurrences.map((item) => item.index), [0, 1, 2, 3]);
});

test("recurrence rejects impossible local dates", () => {
  assert.throws(() => buildOccurrences({
    start: "2031-04-01T02:00:00.000Z",
    end: "2031-04-01T03:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: { cadence: "daily", endDate: "2031-02-30" },
  }), (error) => error.code === "INVALID_RECURRENCE");
});

test("recurrence preserves wall-clock end across a DST transition", () => {
  const result = buildOccurrences({
    start: "2031-03-02T06:30:00.000Z",
    end: "2031-03-02T08:30:00.000Z",
    timezone: "America/New_York",
    recurrence: { cadence: "weekly", interval: 1, weekdays: [0], endDate: "2031-03-09" },
  });
  assert.equal(result.occurrences[1].start, "2031-03-09T06:30:00.000Z");
  assert.equal(result.occurrences[1].end, "2031-03-09T07:30:00.000Z");
});

test("instant parser rejects timestamps without an explicit offset", () => {
  assert.throws(() => parseInstant("2031-03-02T06:30:00", "start"), (error) => error.code === "INVALID_TIME");
  assert.throws(() => parseInstant(1_930_374_600_000, "start"), (error) => error.code === "INVALID_TIME");
});

test("logger emits only allowlisted telemetry fields", () => {
  const original = console.log;
  let output = "";
  console.log = (value) => { output = value; };
  try {
    log("info", "test_event", {
      request_id: "request-1",
      status: 200,
      email: "secret@example.test",
      payload: { subject: "private" },
    });
  } finally {
    console.log = original;
  }

  const entry = JSON.parse(output);
  assert.equal(entry.request_id, "request-1");
  assert.equal(entry.status, 200);
  assert.equal(Object.hasOwn(entry, "email"), false);
  assert.equal(Object.hasOwn(entry, "payload"), false);
});

test("runtime config rejects weak secrets and incomplete TLS", () => {
  const original = {
    jwtSecret: config.jwtSecret,
    isHttps: config.isHttps,
    tlsCertPath: config.tlsCertPath,
    tlsKeyPath: config.tlsKeyPath,
  };
  try {
    config.jwtSecret = "short";
    assert.throws(validateRuntimeConfig, /at least 32 characters/);

    config.jwtSecret = "unit-test-secret-that-is-longer-than-32-characters";
    config.isHttps = true;
    config.tlsCertPath = undefined;
    config.tlsKeyPath = undefined;
    assert.throws(validateRuntimeConfig, /TLS_CERT_PATH/);
  } finally {
    Object.assign(config, original);
  }
});

test("HTTP server factory uses plain HTTP when TLS is disabled", () => {
  const server = createHttpServer((request, response) => response.end("ok"), { isHttps: false });
  assert.ok(server instanceof http.Server);
  server.close();
});

test("launchers never enable a command shell", () => {
  for (const relative of [
    "scripts/dev-client.js",
    "scripts/dev-server.js",
    "scripts/dev-combined.js",
    "scripts/start-client.js",
    "scripts/start-server.js",
  ]) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(source, /shell\s*:\s*true/, relative);
  }
});

test("reconstruction helper refuses implicit or live-server output", () => {
  const script = path.join(root, "scripts/reconstruct-server.mjs");
  const implicit = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  const live = spawnSync(process.execPath, [script, "--output", "server/recovered.js"], { cwd: root, encoding: "utf8" });
  assert.equal(implicit.status, 1);
  assert.equal(live.status, 1);
  assert.equal(fs.existsSync(path.join(root, "server/recovered.js")), false);
});

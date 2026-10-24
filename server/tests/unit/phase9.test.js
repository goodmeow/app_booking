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
    "scripts/demo.js",
    "scripts/start-client.js",
    "scripts/start-server.js",
  ]) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(source, /shell\s*:\s*true/, relative);
  }
});

test("demo launcher is pinned to the disposable reconstruction database", () => {
  const env = fs.readFileSync(path.join(root, ".env.demo"), "utf8");
  const launcher = fs.readFileSync(path.join(root, "scripts/demo.js"), "utf8");
  assert.match(env, /^PGPORT=54320$/m);
  assert.match(env, /^PGDATABASE=360booking_reconstruction_test$/m);
  assert.match(env, /^SERVER_PORT=9091$/m);
  assert.match(launcher, /required\("PGDATABASE", "360booking_reconstruction_test"\)/);
  assert.match(launcher, /rebuild-test-db\.sh/);
  assert.match(launcher, /signalProcessTree/);
  assert.match(launcher, /spawnSync\("ps", \["-eo", "pid=,ppid="\]/);
  assert.match(launcher, /AbortSignal\.timeout/);
  assert.match(launcher, /env\.DOCKER_CONTEXT = "default"/);
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.match(packageJson.scripts["demo:stop"], /--context default/);
  assert.match(packageJson.scripts["demo:stop"], /--file compose\.yaml/);
});

test("parity reset is separated from the demo database", () => {
  const resetScript = fs.readFileSync(path.join(root, "database/scripts/reset-parity-db.sh"), "utf8");
  const rebuildScript = fs.readFileSync(path.join(root, "database/scripts/rebuild-test-db.sh"), "utf8");
  const harness = fs.readFileSync(path.join(root, "server/tests/parity/harness.js"), "utf8");
  const testEnv = fs.readFileSync(path.join(root, ".env.test.example"), "utf8");

  assert.match(resetScript, /PARITY_DATABASE_NAME="360booking_parity_test"/);
  assert.match(resetScript, /DEMO_DATABASE_NAME="360booking_reconstruction_test"/);
  assert.match(resetScript, /BOOKING_PARITY_DB/);
  assert.match(resetScript, /createdb/);

  assert.match(rebuildScript, /DEMO_DATABASE_NAME="360booking_reconstruction_test"/);
  assert.match(rebuildScript, /BOOKING_PARITY_DB/);

  assert.match(harness, /BOOKING_PARITY_DB/);
  assert.match(harness, /360booking_parity_test/);
  assert.doesNotMatch(harness, /PGDATABASE: "360booking_reconstruction_test"/);

  assert.match(testEnv, /^PGDATABASE=360booking_parity_test$/m);
  assert.match(testEnv, /^BOOKING_TEST_DB=360booking_parity_test$/m);

  const demoEnv = fs.readFileSync(path.join(root, ".env.demo"), "utf8");
  assert.match(demoEnv, /^PGDATABASE=360booking_reconstruction_test$/m);
});

test("reconstruction helper refuses implicit or live-server output", () => {
  const script = path.join(root, "scripts/reconstruct-server.mjs");
  const implicit = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  const live = spawnSync(process.execPath, [script, "--output", "server/recovered.js"], { cwd: root, encoding: "utf8" });
  assert.equal(implicit.status, 1);
  assert.equal(live.status, 1);
  assert.equal(fs.existsSync(path.join(root, "server/recovered.js")), false);
});

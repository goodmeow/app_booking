import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoEnvPath = path.join(root, ".env.demo");
const demoEnv = dotenv.parse(fs.readFileSync(demoEnvPath));
// .env.local (git-ignored) for personal overrides, e.g. the CMS LAN origin; it
// deliberately overrides .env.demo so machine-specific values do not enter the repo.
const localEnvPath = path.join(root, ".env.local");
const localEnv = fs.existsSync(localEnvPath) ? dotenv.parse(fs.readFileSync(localEnvPath)) : {};
const env = { ...process.env, ...demoEnv, ...localEnv };
const children = new Set();
const childRoots = new Set();
let stopping = false;

for (const key of ["DOCKER_HOST", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"]) delete env[key];
env.DOCKER_CONTEXT = "default";
env.COMPOSE_FILE = path.join(root, "compose.yaml");
env.COMPOSE_PROJECT_NAME = "360booking";

const required = (key, expected) => {
  if (!env[key] || (expected !== undefined && env[key] !== expected)) {
    throw new Error(`Unsafe demo configuration: ${key} must be ${expected || "set"}`);
  }
};

const validateDemoEnvironment = () => {
  required("NODE_ENV", "development");
  required("PORT", "8081");
  required("SERVER_PORT", "9091");
  required("HOST", "0.0.0.0");
  required("PGHOST", "127.0.0.1");
  required("PGPORT", "54320");
  required("PGDATABASE", "360booking_reconstruction_test");
  required("BOOKING_TEST_PORT", "54320");
  required("BOOKING_TEST_DB", "360booking_reconstruction_test");
  required("DEMO_ADMIN_EMAIL");
  required("DEMO_ADMIN_PASSWORD");
  required("DEMO_ROOM_EMAIL");
  required("DEMO_ROOM_PASSWORD");
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error("Unsafe demo configuration: JWT_SECRET must be at least 32 characters");
  }
};

const networkUrls = () => {
  const urls = new Set([`http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`]);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) urls.add(`http://${entry.address}:${env.PORT}`);
    }
  }
  return [...urls];
};

const addDemoOrigins = () => {
  const origins = new Set(String(env.CORS_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
  for (const url of networkUrls()) origins.add(url);
  env.CORS_ORIGINS = [...origins].join(",");
};

const assertPortFree = (port) => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.unref();
  probe.once("error", () => reject(new Error(`Demo port ${port} is already in use`)));
  probe.listen({ host: "127.0.0.1", port: Number(port) }, () => probe.close(resolve));
});

const run = (command, args, label) => {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
};

const start = (script) => {
  const child = spawn(process.execPath, [path.join(root, script)], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  children.add(child);
  childRoots.add(child.pid);
  child.once("exit", () => children.delete(child));
  child.once("error", (error) => {
    console.error(`${script} failed: ${error.message}`);
    void shutdown("SIGTERM", 1);
  });
  child.once("close", (code, signal) => {
    if (!stopping) {
      console.error(`${script} exited ${signal ? `from ${signal}` : `with code ${code}`}`);
      void shutdown("SIGTERM", code || 1);
    }
  });
  return child;
};

const waitFor = async (label, probe, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await probe()) return;
    } catch {
      // The probe may fail until the process finishes starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${label} readiness timeout`);
};

const waitForServer = async () => {
  await waitFor("Server", async () => {
    const response = await fetch(`http://127.0.0.1:${env.SERVER_PORT}/api/auth/signout`, {
      signal: AbortSignal.timeout(1_500),
    });
    return response.status === 200;
  });
  const response = await fetch(`http://127.0.0.1:${env.SERVER_PORT}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.DEMO_ADMIN_EMAIL, password: env.DEMO_ADMIN_PASSWORD }),
    signal: AbortSignal.timeout(5_000),
  });
  if (response.status !== 200) throw new Error(`Demo login preflight failed with HTTP ${response.status}`);
};

const waitForClient = () => waitFor("Client", async () => {
  const [rootResponse, proxyResponse] = await Promise.all([
    fetch(`http://127.0.0.1:${env.PORT}/`, { signal: AbortSignal.timeout(1_500) }),
    fetch(`http://127.0.0.1:${env.PORT}/api/auth/signout`, { signal: AbortSignal.timeout(1_500) }),
  ]);
  return rootResponse.status === 200 && proxyResponse.status === 200;
});

async function stopChild(child, signal) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  signalChild(child, signal);
  if (await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 2_000, "timeout"))]) === "timeout") {
    signalChild(child, "SIGKILL");
    await exited;
  }
}

function signalChild(child, signal) {
  signalProcessTree(child.pid, signal);
}

async function shutdown(signal = "SIGTERM", exitCode = 0) {
  if (stopping) return;
  stopping = true;
  signalAllChildren(signal);
  await Promise.all([...children].map((child) => stopChild(child, signal)));
  process.exitCode = exitCode;
}

function signalAllChildren(signal) {
  for (const pid of childRoots) signalProcessTree(pid, signal);
}

function signalProcessTree(rootPid, signal) {
  if (process.platform === "win32") {
    const child = [...children].find((entry) => entry.pid === rootPid);
    child?.kill(signal);
    return;
  }
  const result = spawnSync("ps", ["-eo", "pid=,ppid="], { encoding: "utf8" });
  const descendants = new Map();
  if (result.status === 0) {
    for (const line of String(result.stdout || "").trim().split("\n")) {
      const [pid, parentPid] = line.trim().split(/\s+/).map(Number);
      if (!Number.isInteger(pid) || !Number.isInteger(parentPid)) continue;
      if (!descendants.has(parentPid)) descendants.set(parentPid, []);
      descendants.get(parentPid).push(pid);
    }
  }
  const targets = [];
  const collect = (pid) => {
    for (const childPid of descendants.get(pid) || []) collect(childPid);
    targets.push(pid);
  };
  collect(rootPid);
  for (const pid of targets) {
    try {
      process.kill(pid, signal);
    } catch {
      // A child may already have exited between ps and kill.
    }
  }
}

async function main() {
  validateDemoEnvironment();
  addDemoOrigins();
  await Promise.all([assertPortFree(env.PORT), assertPortFree(env.SERVER_PORT)]);

  // Docker 29 moved compose to a separate binary; pick the command that
  // is actually available before starting the demo database.
  let composeCommand = null;
  try {
    run("docker", ["compose", "version"], "Docker Compose preflight");
    composeCommand = ["docker", "compose"];
  } catch {
    composeCommand = ["docker-compose"];
  }
  run(composeCommand[0], [...composeCommand.slice(1), "--env-file", ".env.demo", "up", "-d", "--wait", "postgres-test"], "Demo database startup");
  run(path.join(root, "database/scripts/rebuild-test-db.sh"), [], "Demo database rebuild");

  start("scripts/dev-server.js");
  await waitForServer();
  start("scripts/dev-client.js");
  await waitForClient();

  console.log("Demo ready:");
  for (const url of networkUrls()) console.log(`- Web: ${url}`);
  console.log(`- Kiosk: http://localhost:${env.PORT}/kiosk`);
  console.log(`- Kiosk setup: http://localhost:${env.PORT}/kiosk/setup`);
  console.log(`- API/Socket.io: http://localhost:${env.SERVER_PORT}`);
  console.log(`- Web login: ${env.DEMO_ADMIN_EMAIL}`);
  console.log(`- Kiosk login: ${env.DEMO_ROOM_EMAIL}`);
  console.log("Press Ctrl+C to stop application processes.");
  console.log("Run `npm run demo:stop` to stop the disposable PostgreSQL container.");
}

for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"]) {
  process.once(signal, () => { void shutdown(signal, signal === "SIGINT" ? 130 : 143); });
}

process.once("exit", () => signalAllChildren("SIGKILL"));

main().catch(async (error) => {
  console.error(`Demo failed: ${error.message}`);
  await shutdown("SIGTERM", 1);
});

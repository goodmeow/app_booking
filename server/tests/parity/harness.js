import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const legacySource = path.join(root, "dist/server/server.bundle.js");
const legacyRuntime = path.join(root, "build/parity/legacy.bundle.cjs");
const legacyExpressJwtShim = path.join(root, "server/tests/parity/legacy-express-jwt.cjs");

export const parityPassword = "ParityTest123!";
export const testSecret = "parity-test-secret-at-least-32-characters";

export const targets = {
  legacy: {
    name: "legacy",
    port: 5101,
    entry: legacyRuntime,
  },
  reconstructed: {
    name: "reconstructed",
    port: 5102,
    entry: path.join(root, "server/server.js"),
  },
};

export async function prepareLegacyBundle() {
  await fs.mkdir(path.dirname(legacyRuntime), { recursive: true });
  const source = await fs.readFile(legacySource, "utf8");
  await fs.writeFile(
    legacyRuntime,
    source.replace('require("express-jwt")', `require(${JSON.stringify(legacyExpressJwtShim)})`)
  );
  return legacyRuntime;
}

async function runProcess(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk.toString()));
    child.stderr.on("data", (chunk) => output.push(chunk.toString()));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(output.join(""));
      else reject(new Error(`${command} exited ${code}\n${output.join("").slice(-8000)}`));
    });
    child.stdin.end(input || "");
  });
}

export async function queryParityDatabase(sql) {
  const command =
    "docker compose exec -T postgres-test psql " +
    "-v ON_ERROR_STOP=1 -At -U booking_test " +
    "-d 360booking_reconstruction_test";
  return (await runProcess("sg", ["docker", "-c", command], sql)).trim();
}

export async function resetParityDatabase() {
  const script = "database/scripts/reset-parity-db.sh";
  try {
    return await runProcess(script, []);
  } catch (error) {
    if (!String(error.message).includes("permission denied")) throw error;
    return runProcess("sg", ["docker", "-c", script]);
  }
}

export async function withIsolatedTarget(target, callback) {
  await resetParityDatabase();
  const child = await startServer(target);
  try {
    return await callback(target);
  } finally {
    await stopServer(child);
  }
}

function boundedLog(target, stream, chunks) {
  stream.on("data", (chunk) => {
    chunks.push(chunk.toString());
    if (chunks.length > 100) chunks.shift();
  });
  stream.on("error", () => {});
  return () => `[${target.name}] ${chunks.join("").slice(-8000)}`;
}

export async function startServer(target) {
  if (target.name === "legacy") await prepareLegacyBundle();

  const child = spawn(process.execPath, [target.entry], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      SERVER_PORT: String(target.port),
      HTTPS: "false",
      SSR: "false",
      PGHOST: "127.0.0.1",
      PGPORT: "54320",
      PGUSER: "booking_test",
      PGPASSWORD: "booking_test_local_only",
      PGDATABASE: "360booking_reconstruction_test",
      JWT_SECRET: testSecret,
      JWT_ISSUER: "360-scheduler",
      JWT_AUDIENCE: "360-scheduler-web",
      JWT_EXPIRY_TOKEN: "1h",
      CORS_ORIGINS: "http://127.0.0.1:3000",
      APP_TIMEZONE: "Asia/Jakarta",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs = [];
  const getStdout = boundedLog(target, child.stdout, logs);
  const getStderr = boundedLog(target, child.stderr, logs);
  const deadline = Date.now() + 10_000;
  const url = `http://127.0.0.1:${target.port}/api/auth/signout`;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early.\n${getStdout()}\n${getStderr()}`);
    }
    try {
      const response = await fetch(url);
      if (response.status === 200) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await stopServer(child);
  throw new Error(`Server readiness timeout.\n${getStdout()}\n${getStderr()}`);
}

export async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const timeout = new Promise((resolve) => setTimeout(resolve, 2_000, "timeout"));
  if ((await Promise.race([exited, timeout])) === "timeout") {
    child.kill("SIGKILL");
    const killTimeout = new Promise((resolve) =>
      setTimeout(resolve, 2_000, "kill-timeout")
    );
    if ((await Promise.race([exited, killTimeout])) === "kill-timeout") {
      throw new Error(`Server process ${child.pid} did not exit after SIGKILL`);
    }
  }
}

export async function apiRequest(target, pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${target.port}${pathname}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return {
    status: response.status,
    body,
    setCookie: response.headers.get("set-cookie"),
  };
}

export function normalizeDynamic(value) {
  if (Array.isArray(value)) return value.map(normalizeDynamic);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key === "token") return [key, "<jwt>"];
      if (["created_at", "updated_at", "checked_in"].includes(key) && item) {
        return [key, "<timestamp>"];
      }
      return [key, normalizeDynamic(item)];
    })
  );
}

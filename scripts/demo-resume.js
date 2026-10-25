import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Continues the demo WITHOUT rebuilding the database: the PostgreSQL container
// is restarted if it is down, then the CMS (:8081) and API (:9091) are started.
// Use it after a machine restart so tablet pairing and the demo DB contents are kept
// (unlike `npm run demo`, which always resets the database).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readEnv = (file) => {
  const full = path.join(root, file);
  return fs.existsSync(full) ? dotenv.parse(fs.readFileSync(full)) : {};
};

const env = { ...process.env, ...readEnv(".env.demo"), ...readEnv(".env.local") };

// Docker 29 moved `compose` to a plugin; some machines only have the old
// docker-compose binary, so both are tried.
const composeArgs = [
  "--project-name", env.COMPOSE_PROJECT_NAME || "360booking",
  "--file", "compose.yaml",
  "--env-file", ".env.demo",
];
const composeModern = spawnSync("docker", ["compose", "version"], { env, stdio: "ignore" }).status === 0;
const composeBin = composeModern ? "docker" : "docker-compose";
const composePrefix = composeModern ? ["compose", ...composeArgs] : composeArgs;

console.log(`Starting the database container (no reset) with ${composeBin}...`);
const started = spawnSync(composeBin, [...composePrefix, "up", "-d", "postgres-test"], {
  cwd: root,
  env,
  stdio: "inherit",
});
if (started.status !== 0) {
  console.error("Failed to start the database container. Check Docker Desktop.");
  process.exit(started.status ?? 1);
}

console.log(`Starting the CMS :${env.PORT || 8081} and API :${env.SERVER_PORT || 9091}...`);
const dev = spawn(process.execPath, ["scripts/dev-combined.js"], {
  cwd: root,
  env,
  stdio: "inherit",
});

dev.on("close", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => dev.kill(signal));
}

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Melanjutkan demo TANPA membangun ulang database: container PostgreSQL
// dinyalakan kembali bila mati, lalu CMS (:8081) dan API (:9091) dijalankan.
// Dipakai setelah restart mesin agar pairing tablet dan isi DB demo tetap ada
// (berbeda dengan `npm run demo` yang selalu reset database).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readEnv = (file) => {
  const full = path.join(root, file);
  return fs.existsSync(full) ? dotenv.parse(fs.readFileSync(full)) : {};
};

const env = { ...process.env, ...readEnv(".env.demo"), ...readEnv(".env.local") };

// Docker 29 memindahkan `compose` ke plugin; sebagian mesin hanya punya
// binary docker-compose lama, jadi dicoba keduanya.
const composeArgs = [
  "--project-name", env.COMPOSE_PROJECT_NAME || "360booking",
  "--file", "compose.yaml",
  "--env-file", ".env.demo",
];
const composeModern = spawnSync("docker", ["compose", "version"], { env, stdio: "ignore" }).status === 0;
const composeBin = composeModern ? "docker" : "docker-compose";
const composePrefix = composeModern ? ["compose", ...composeArgs] : composeArgs;

console.log(`Menyalakan container database (tanpa reset) lewat ${composeBin}...`);
const started = spawnSync(composeBin, [...composePrefix, "up", "-d", "postgres-test"], {
  cwd: root,
  env,
  stdio: "inherit",
});
if (started.status !== 0) {
  console.error("Gagal menyalakan container database. Periksa Docker Desktop.");
  process.exit(started.status ?? 1);
}

console.log(`Menjalankan CMS :${env.PORT || 8081} dan API :${env.SERVER_PORT || 9091}...`);
const dev = spawn(process.execPath, ["scripts/dev-combined.js"], {
  cwd: root,
  env,
  stdio: "inherit",
});

dev.on("close", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => dev.kill(signal));
}

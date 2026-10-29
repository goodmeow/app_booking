import { execFile } from "node:child_process";
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import config from "../../../config/config.js";
import { getPool, query } from "../../db/pool.js";
import { badRequest } from "../../lib/http-error.js";
import { getSettings } from "./setting.repository.js";

const execFileAsync = promisify(execFile);
const RUNNING = { current: false };

const dateKey = (value = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: config.appTimezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(value);

const localTime = (value = new Date()) => new Intl.DateTimeFormat("en-GB", {
  timeZone: config.appTimezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(value);

const safeDirectory = (value) => {
  const directory = path.resolve(String(value || ""));
  if (!path.isAbsolute(directory) || directory.includes("\0")) {
    throw badRequest("INVALID_BACKUP_PATH", "Backup path must be absolute");
  }
  return directory;
};

const markResult = async (status) => query(
  `UPDATE tbl_app_settings
   SET backup_last_at = now(), backup_last_status = $1
   WHERE _id = (SELECT _id FROM tbl_app_settings ORDER BY created_at LIMIT 1)`,
  [status]
);

export const runBackup = async ({ force = false } = {}) => {
  if (RUNNING.current) throw badRequest("BACKUP_RUNNING", "A backup is already running");
  // Reserve the slot before the first await: two requests must not both pass
  // the check and start pg_dump together.
  RUNNING.current = true;
  let part = null;
  let lockClient = null;
  let hasLock = false;
  try {
    // The in-process flag does not protect another app replica. Hold a
    // database advisory lock so only one process can run pg_dump at a time.
    lockClient = await getPool().connect();
    const lock = await lockClient.query(
      "SELECT pg_try_advisory_lock(hashtext('360booking_backup')) AS locked"
    );
    if (!lock.rows[0]?.locked) {
      throw badRequest("BACKUP_RUNNING", "A backup is already running");
    }
    hasLock = true;

    const settings = await getSettings();
    if (!settings) throw badRequest("BACKUP_SETTINGS_MISSING", "Backup settings are not available");
    if (!force && !settings.backup_enabled) throw badRequest("BACKUP_DISABLED", "Backup is disabled");

    const directory = safeDirectory(settings.backup_path);
    await mkdir(directory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const filename = `${(config.pgConn.database || "360booking")}-${stamp}.dump`;
    const target = path.join(directory, filename);
    part = `${target}.part`;
    const env = {
      ...process.env,
      PGHOST: config.pgConn.host,
      PGPORT: String(config.pgConn.port || 5432),
      PGDATABASE: config.pgConn.database,
      PGUSER: config.pgConn.user,
      PGPASSWORD: config.pgConn.password,
    };

    await execFileAsync("pg_dump", ["--format=custom", "--file", part], { env, timeout: 15 * 60_000 });
    await execFileAsync("pg_restore", ["--list", part], { env, timeout: 60_000 });
    await rename(part, target);
    part = null;
    const info = await stat(target);
    const days = Math.max(1, Math.min(365, Number(settings.backup_retention_days) || 14));
    const cutoff = Date.now() - days * 24 * 60 * 60_000;
    for (const entry of await readdir(directory)) {
      if (!entry.startsWith(`${config.pgConn.database || "360booking"}-`) || !entry.endsWith(".dump")) continue;
      const file = path.join(directory, entry);
      const fileInfo = await stat(file);
      if (fileInfo.mtimeMs < cutoff) await unlink(file);
    }
    await markResult(`ok ${filename} ${info.size} bytes`);
    return { filename, path: target, bytes: info.size };
  } catch (error) {
    if (part) await unlink(part).catch(() => {});
    await markResult(`error ${error.message}`.slice(0, 500));
    throw error;
  } finally {
    if (lockClient) {
      if (hasLock) {
        await lockClient
          .query("SELECT pg_advisory_unlock(hashtext('360booking_backup'))")
          .catch(() => {});
      }
      lockClient.release();
    }
    RUNNING.current = false;
  }
};

export const startBackupScheduler = () => {
  let lastAttemptAt = 0;
  const retryCooldownMs = 5 * 60_000;
  const tick = async () => {
    try {
      const settings = await getSettings();
      if (!settings?.backup_enabled || RUNNING.current) return;
      const now = new Date();
      if (localTime(now) < settings.backup_time) return;
      const succeededToday = settings.backup_last_at
        && dateKey(new Date(settings.backup_last_at)) === dateKey(now)
        && String(settings.backup_last_status || "").startsWith("ok");
      if (succeededToday) return;
      if (Date.now() - lastAttemptAt < retryCooldownMs) return;
      lastAttemptAt = Date.now();
      await runBackup();
    } catch (error) {
      console.error("backup schedule failed", error.message);
    }
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  setTimeout(tick, 5_000).unref();
};

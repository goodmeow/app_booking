import { query } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { log } from "../observability/logger.js";

// One named window for the short-lived limits used by auth and kiosk routes.
export const SHORT_WINDOW_MS = 15 * 60_000;

// Counters are shared through Postgres so the limit holds when the app runs as
// more than one process. Every 100 requests a limiter also deletes expired rows
// in the background; older counters are useless and would grow without bound.
const CLEANUP_EVERY_REQUESTS = 100;
const RETENTION_MS = 24 * 60 * 60_000;

const clientAddress = (req) => req.ip || req.socket?.remoteAddress || "unknown";

// Key for limiting attempts against one account from one address, so an office
// that shares an IP or proxy is not locked out by other people's attempts.
export const ipAndLoginKey = (req) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const login = String(body.email || body.username || "").trim().toLowerCase().slice(0, 254);
  return `${clientAddress(req)}|${login}`;
};

// A store keeps one counter per bucket. hit() increments and returns the new
// count for the window; release() gives one hit back; cleanup() drops old rows.
// The window start is computed by the caller so the SQL needs no clock logic.
export const createMemoryStore = () => {
  const buckets = new Map();
  const maxBuckets = 10_000;

  return {
    hit({ bucketKey, windowStart }) {
      const current = buckets.get(bucketKey);
      if (!current && buckets.size >= maxBuckets) buckets.delete(buckets.keys().next().value);

      const entry = !current || current.windowStart < windowStart
        ? { windowStart, count: 0 }
        : current;
      entry.count += 1;
      buckets.set(bucketKey, entry);

      return { count: entry.count };
    },

    async release({ bucketKey, windowStart }) {
      const entry = buckets.get(bucketKey);
      if (entry && entry.windowStart === windowStart) entry.count = Math.max(0, entry.count - 1);
    },

    async cleanup({ olderThan }) {
      for (const [key, entry] of buckets) {
        if (entry.windowStart < olderThan.getTime()) buckets.delete(key);
      }
    },
  };
};

// Starts a new window when the stored one is older; otherwise counts one more
// hit. The upsert is a single statement, so concurrent processes cannot both
// read the old count and each write it back.
const INCREMENT_SQL = `
INSERT INTO tbl_rate_limit_buckets AS bucket
  (bucket_key, window_start, hits)
VALUES ($1, $2, 1)
ON CONFLICT (bucket_key) DO UPDATE
SET
  hits = CASE
    WHEN bucket.window_start < EXCLUDED.window_start THEN 1
    ELSE bucket.hits + 1
  END,
  window_start = EXCLUDED.window_start
RETURNING hits
`;

// Only the window that was counted is refunded, never a newer one.
const RELEASE_SQL = `
UPDATE tbl_rate_limit_buckets
SET hits = GREATEST(hits - 1, 0)
WHERE bucket_key = $1
  AND window_start = $2
`;

const CLEANUP_SQL = `
DELETE FROM tbl_rate_limit_buckets
WHERE window_start < $1
`;

export const createPostgresStore = (execute = query) => ({
  async hit({ bucketKey, windowStart }) {
    const result = await execute(INCREMENT_SQL, [bucketKey, new Date(windowStart)]);
    return { count: result.rows[0].hits };
  },

  async release({ bucketKey, windowStart }) {
    await execute(RELEASE_SQL, [bucketKey, new Date(windowStart)]);
  },

  async cleanup({ olderThan }) {
    await execute(CLEANUP_SQL, [olderThan]);
  },
});

const defaultStore = createPostgresStore();

export const fixedWindowRateLimit = ({
  scope,
  windowMs,
  max,
  keyGenerator = clientAddress,
  skipSuccessfulRequests = false,
  store = defaultStore,
}) => {
  if (!scope) throw new Error("fixedWindowRateLimit requires a scope");

  let requestCount = 0;
  let warnedWindowStart = null;

  // Rate limiting is defense in depth: when the shared store is unreachable the
  // request is allowed through, with one warning per window to avoid log floods.
  const failOpen = (error, windowStart, next) => {
    if (warnedWindowStart !== windowStart) {
      warnedWindowStart = windowStart;
      log("warn", "rate_limit_store_error", {
        operation: scope,
        error_code: error?.code || "RATE_LIMIT_STORE_ERROR",
      });
    }
    next();
  };

  return (req, res, next) => {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const bucketKey = `${scope}|${keyGenerator(req)}`;

    requestCount += 1;
    if (requestCount % CLEANUP_EVERY_REQUESTS === 0) {
      const olderThan = new Date(now - RETENTION_MS);
      Promise.resolve()
        .then(() => store.cleanup({ olderThan }))
        .catch(() => {});
    }

    const admit = ({ count }) => {
      // The store reply can arrive after the client gave up.
      if (res.headersSent) return;

      res.set("RateLimit-Limit", String(max));
      res.set("RateLimit-Remaining", String(Math.max(0, max - count)));
      res.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

      if (count > max) return next(new HttpError(429, "RATE_LIMITED", "Too many authentication attempts"));
      next();
    };

    let counted;
    try {
      counted = store.hit({ bucketKey, windowStart });
    } catch (error) {
      failOpen(error, windowStart, next);
      return;
    }

    Promise.resolve(counted).then(admit, (error) => failOpen(error, windowStart, next));

    // Only failed attempts are counted: a successful login gives its quota back
    // when the response finishes.
    if (skipSuccessfulRequests) {
      res.once("finish", () => {
        if (res.statusCode >= 400) return;
        Promise.resolve()
          .then(() => store.release({ bucketKey, windowStart }))
          .catch(() => {});
      });
    }
  };
};

// Only failed attempts are counted. One limiter guards a single account per
// address, another guards an address that tries many accounts at once. Each
// limiter needs its own scope, because the scope is part of the shared key.
export const failedLoginRateLimits = ({
  scope,
  windowMs = SHORT_WINDOW_MS,
  perAccount = 10,
  perAddress = 100,
  store,
} = {}) => {
  if (!scope) throw new Error("failedLoginRateLimits requires a scope");

  return [
    fixedWindowRateLimit({ scope: `${scope}:address`, windowMs, max: perAddress, skipSuccessfulRequests: true, store }),
    fixedWindowRateLimit({ scope: `${scope}:account`, windowMs, max: perAccount, keyGenerator: ipAndLoginKey, skipSuccessfulRequests: true, store }),
  ];
};

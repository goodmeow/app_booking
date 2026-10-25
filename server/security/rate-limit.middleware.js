import { HttpError } from "../lib/http-error.js";

// One named window for the short-lived limits used by auth and kiosk routes.
export const SHORT_WINDOW_MS = 15 * 60_000;

const clientAddress = (req) => req.ip || req.socket?.remoteAddress || "unknown";

// Key for limiting attempts against one account from one address, so an office
// that shares an IP or proxy is not locked out by other people's attempts.
export const ipAndLoginKey = (req) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const login = String(body.email || body.username || "").trim().toLowerCase().slice(0, 254);
  return `${clientAddress(req)}|${login}`;
};

export const fixedWindowRateLimit = ({
  windowMs,
  max,
  keyGenerator = clientAddress,
  skipSuccessfulRequests = false,
}) => {
  const clients = new Map();
  const maxKeys = 10_000;
  let requestCount = 0;

  return (req, res, next) => {
    const now = Date.now();
    requestCount += 1;
    if (requestCount % 100 === 0) {
      for (const [storedKey, stored] of clients) {
        if (stored.resetAt <= now) clients.delete(storedKey);
      }
    }

    const key = keyGenerator(req);
    const current = clients.get(key);
    if (!current && clients.size >= maxKeys) clients.delete(clients.keys().next().value);

    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    entry.count += 1;
    clients.set(key, entry);

    // Only failed attempts are counted: a successful login gives its quota back
    // when the response finishes.
    if (skipSuccessfulRequests) {
      res.once("finish", () => {
        if (res.statusCode < 400 && clients.get(key) === entry) {
          entry.count = Math.max(0, entry.count - 1);
        }
      });
    }

    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.set("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) return next(new HttpError(429, "RATE_LIMITED", "Too many authentication attempts"));
    next();
  };
};

// Only failed attempts are counted. One limiter guards a single account per
// address, another guards an address that tries many accounts at once.
export const failedLoginRateLimits = ({ windowMs = SHORT_WINDOW_MS, perAccount = 10, perAddress = 100 } = {}) => [
  fixedWindowRateLimit({ windowMs, max: perAddress, skipSuccessfulRequests: true }),
  fixedWindowRateLimit({ windowMs, max: perAccount, keyGenerator: ipAndLoginKey, skipSuccessfulRequests: true }),
];

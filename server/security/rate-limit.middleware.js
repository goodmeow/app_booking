import { HttpError } from "../lib/http-error.js";

export const fixedWindowRateLimit = ({ windowMs, max }) => {
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
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = clients.get(key);
    if (!current && clients.size >= maxKeys) clients.delete(clients.keys().next().value);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    entry.count += 1;
    clients.set(key, entry);
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.set("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) return next(new HttpError(429, "RATE_LIMITED", "Too many authentication attempts"));
    next();
  };
};

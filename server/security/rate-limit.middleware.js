import { HttpError } from "../lib/http-error.js";

const clientAddress = (req) => req.ip || req.socket?.remoteAddress || "unknown";

// Kunci untuk membatasi percobaan terhadap satu akun dari satu alamat, supaya
// kantor yang berbagi IP atau proxy tidak ikut terkunci oleh percobaan orang lain.
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

    // Hanya percobaan gagal yang dihitung: login yang berhasil mengembalikan
    // jatahnya saat respons selesai.
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

// Hanya percobaan gagal yang dihitung. Satu limiter menjaga satu akun per
// alamat, satu lagi menjaga alamat yang mencoba banyak akun sekaligus.
export const failedLoginRateLimits = ({ windowMs = 15 * 60_000, perAccount = 10, perAddress = 100 } = {}) => [
  fixedWindowRateLimit({ windowMs, max: perAddress, skipSuccessfulRequests: true }),
  fixedWindowRateLimit({ windowMs, max: perAccount, keyGenerator: ipAndLoginKey, skipSuccessfulRequests: true }),
];

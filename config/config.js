import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.production" : ".env";
dotenv.config({ path: envFile });

const env = process.env;
const host = env.HOST || "localhost";
const clientPort = env.PORT || "8081";
const serverPort = env.SERVER_PORT || "9091";
const trustProxy = !env.TRUST_PROXY || env.TRUST_PROXY === "false"
  ? false
  : env.TRUST_PROXY === "true"
    ? true
    : /^\d+$/.test(env.TRUST_PROXY)
      ? Number(env.TRUST_PROXY)
      : env.TRUST_PROXY;
const baseUrl = `${env.HTTPS === "true" ? "https" : "http"}://${host}:${clientPort}`;
const serverBaseUrl = `${env.HTTPS === "true" ? "https" : "http"}://${host}:${serverPort}`;
const corsOrigins = (env.CORS_ORIGINS || baseUrl || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const config = {
  isProduction: nodeEnv === "production",
  ssrMode: env.SSR === "true",
  port: clientPort,
  serverPort,
  base: env.BASE,
  baseUrl: baseUrl || "http://localhost:3000",
  serverBaseUrl: serverBaseUrl || "http://localhost:5000",
  isHttps: env.HTTPS === "true",
  jwtSecret: env.JWT_SECRET,
  jwtExpiry: env.JWT_EXPIRY_TOKEN || "1d",
  jwtIssuer: env.JWT_ISSUER || "360-scheduler",
  jwtAudience: env.JWT_AUDIENCE || "360-scheduler-web",
  kioskJwtAudience: env.KIOSK_JWT_AUDIENCE || "360-scheduler-kiosk",
  kioskJwtExpiry: env.KIOSK_JWT_EXPIRY || "15m",
  kioskRefreshDays: Number(env.KIOSK_REFRESH_DAYS || 30),
  corsOrigins,
  trustProxy,
  tlsCertPath: env.TLS_CERT_PATH,
  tlsKeyPath: env.TLS_KEY_PATH,
  appTimezone: env.APP_TIMEZONE || "Asia/Jakarta",
  maxBookingDurationHours: Number(env.MAX_BOOKING_DURATION_HOURS || 168),
  maxCalendarRangeDays: Number(env.MAX_CALENDAR_RANGE_DAYS || 366),
  // Turn off temporarily while employee floors are not filled in (FLOOR_RESTRICTION=false).
  floorRestriction: String(env.FLOOR_RESTRICTION ?? "true").toLowerCase() !== "false",
  maxPreviewConflicts: Number(env.MAX_PREVIEW_CONFLICTS || 50),
  recurrenceMaxDays: Number(env.RECURRENCE_MAX_DAYS || 366),
  recurrenceMaxOccurrences: Number(env.RECURRENCE_MAX_OCCURRENCES || 200),
  pgConn: {
    user: env.PGUSER,
    host: env.PGHOST,
    database: env.PGDATABASE,
    password: env.PGPASSWORD,
    port: env.PGPORT,
  },
};

export const validateRuntimeConfig = () => {
  if (!config.jwtSecret || config.jwtSecret.length < 32 || /^(change-me|your[_-]?secret)/i.test(config.jwtSecret)) {
    throw new Error("JWT_SECRET must be a non-placeholder secret of at least 32 characters");
  }
  if (config.isHttps && (!config.tlsCertPath || !config.tlsKeyPath)) {
    throw new Error("TLS_CERT_PATH and TLS_KEY_PATH are required when HTTPS=true");
  }
  if (!Number.isFinite(config.maxBookingDurationHours) || config.maxBookingDurationHours <= 0) {
    throw new Error("MAX_BOOKING_DURATION_HOURS must be a positive number");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: config.appTimezone }).format();
  } catch {
    throw new Error("APP_TIMEZONE must be a supported IANA timezone");
  }
  if (!Number.isInteger(config.maxCalendarRangeDays) || config.maxCalendarRangeDays <= 0) {
    throw new Error("MAX_CALENDAR_RANGE_DAYS must be a positive integer");
  }
  if (!Number.isInteger(config.maxPreviewConflicts) || config.maxPreviewConflicts <= 0) {
    throw new Error("MAX_PREVIEW_CONFLICTS must be a positive integer");
  }
  if (!Number.isInteger(config.recurrenceMaxDays) || config.recurrenceMaxDays <= 0) {
    throw new Error("RECURRENCE_MAX_DAYS must be a positive integer");
  }
  if (!Number.isInteger(config.recurrenceMaxOccurrences) || config.recurrenceMaxOccurrences <= 0) {
    throw new Error("RECURRENCE_MAX_OCCURRENCES must be a positive integer");
  }
  if (!Number.isInteger(config.kioskRefreshDays) || config.kioskRefreshDays <= 0) {
    throw new Error("KIOSK_REFRESH_DAYS must be a positive integer");
  }
  return config;
};

export default config;

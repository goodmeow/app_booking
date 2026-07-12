import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.production" : ".env";
dotenv.config({ path: envFile });

const env = process.env;
const baseUrl = `${env.HTTPS === "true" ? "https" : "http"}://${env.HOST}${env.PORT === "" ? "" : `:${env.PORT}`}`;
const serverBaseUrl = `${env.HTTPS === "true" ? "https" : "http"}://${env.HOST}${env.SERVER_PORT === "" ? "" : `:${env.SERVER_PORT}`}`;

const config = {
  isProduction: nodeEnv === "production",
  ssrMode: env.SSR === "true",
  port: env.PORT || 3000,
  serverPort: env.SERVER_PORT || 5000,
  base: env.BASE,
  baseUrl: baseUrl || "http://localhost:3000",
  serverBaseUrl: serverBaseUrl || "http://localhost:5000",
  isHttps: env.HTTPS === "true",
  jwtSecret: env.JWT_SECRET || "YOUR_secret_key",
  pgConn: {
    user: env.PGUSER,
    host: env.PGHOST,
    database: env.PGDATABASE,
    password: env.PGPASSWORD,
    port: env.PGPORT,
  },
  redis: {
    host: env.REDIS_HOST || "localhost",
    port: env.REDIS_PORT || 6379,
    key: env.REDIS_KEY || "",
    db: env.REDIS_DB || 0,
  },
  employeeSuffix: env.EMPLOYEE_SUFFIX,
  roomSuffix: env.ROOM_SUFFIX,
};

export default config;

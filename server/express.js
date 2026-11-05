import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import config from "../config/config.js";
import { HttpError } from "./lib/http-error.js";
import { requestTelemetry } from "./middleware/request-telemetry.js";

const app = express();
app.set("trust proxy", config.trustProxy);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
// A request without a body must reach the controllers as an empty object, not
// as undefined; otherwise the first property read becomes a 500 instead of a
// normal validation error.
app.use((req, res, next) => {
  if (req.body == null) req.body = {};
  next();
});
app.use(compression());
// The CMS is served by nginx, so the policy that protects it is repeated in
// deploy/docker/nginx.conf. Keep both copies identical.
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    // Ant Design 5 injects its styles at runtime.
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'", "ws:", "wss:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
};
app.use(helmet({ contentSecurityPolicy }));
app.use(requestTelemetry);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      callback(new HttpError(403, "CORS_ORIGIN", "Origin is not allowed"));
    },
  }),
);

export default app;

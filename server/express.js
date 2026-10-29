import express from "express";
import bodyParser from "body-parser";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import config from "../config/config.js";
import { HttpError } from "./lib/http-error.js";
import { requestTelemetry } from "./middleware/request-telemetry.js";

const app = express();
app.set("trust proxy", config.trustProxy);

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));
// A request without a body must reach the controllers as an empty object, not
// as undefined; otherwise the first property read becomes a 500 instead of a
// normal validation error.
app.use((req, res, next) => {
  if (req.body == null) req.body = {};
  next();
});
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(requestTelemetry);
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    callback(new HttpError(403, "CORS_ORIGIN", "Origin is not allowed"));
  },
}));

export default app;

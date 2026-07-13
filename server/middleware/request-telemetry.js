import { randomUUID } from "node:crypto";
import { log } from "../observability/logger.js";

export const requestTelemetry = (req, res, next) => {
  const requestId = req.get("X-Request-ID") || randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.set("X-Request-ID", requestId);
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    log(res.statusCode >= 500 ? "error" : "info", "http_request", {
      request_id: requestId,
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
    });
  });
  next();
};

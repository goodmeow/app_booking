import config, { validateRuntimeConfig } from "../config/config.js";
import app from "./express.js";
import { Server } from "socket.io";
import webSocket from "./socket/webSocket.js";
import routes from "./routes/index.js";
import { createHttpServer } from "./runtime/create-http-server.js";
import { closePool } from "./db/pool.js";
import { releaseAbandonedBookings } from "./features/events/event.service.js";
import { startBackupScheduler } from "./features/settings/backup.service.js";
import { deleteExpiredAudit } from "./features/audit/audit.repository.js";
import { findEventAudience } from "./features/events/event.repository.js";
import { emitEventInvalidation } from "./socket/event-invalidation.js";
import { log } from "./observability/logger.js";

validateRuntimeConfig();
const port = config.ssrMode ? config.port : config.serverPort;
const server = createHttpServer(app, config);

const io = new Server(server, {
  transports: ["websocket", "polling"],
  cors: { origin: config.corsOrigins, credentials: true },
});

webSocket(io);
app.use((req, res, next) => {
  req.io = io;
  next();
});
app.use("/api", routes);
app.use((err, req, res, next) => {
  if (!err) return next();
  const status = Number(err.status) || 500;
  const errorCode = err.code || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  log(status >= 500 ? "error" : "info", "request_error", {
    request_id: req.requestId,
    status,
    error_code: errorCode,
  });
  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
    code: errorCode,
    ...(err.details === undefined ? {} : { details: err.details }),
  });
});

server.listen(port, () => {
  log("info", "server_started", { operation: config.ssrMode ? "client_server" : "server" });
});

// Release rooms of meetings that were not checked in by the late limit.
const releaseAbandonedTimer = setInterval(async () => {
  try {
    const releasedEventIds = await releaseAbandonedBookings();
    if (releasedEventIds.length) {
      emitEventInvalidation(io, await findEventAudience(releasedEventIds));
    }
  } catch (error) {
    // logger only serialises allow-listed fields; error.message would be
    // dropped. Keep the actionable code without leaking database text.
    log("error", "auto_release_failed", { error_code: error.code || "AUTO_RELEASE_FAILED" });
  }
}, 60_000);
releaseAbandonedTimer.unref();
startBackupScheduler();

// Keep the audit table bounded. A daily job is enough for the write volume of
// this CMS; the retention is configurable for compliance requirements.
const pruneAudit = async () => {
  try {
    await deleteExpiredAudit(config.auditRetentionDays);
  } catch (error) {
    log("error", "audit_retention_failed", { error_code: error.code || "AUDIT_RETENTION_FAILED" });
  }
};
const auditRetentionTimer = setInterval(pruneAudit, 24 * 60 * 60_000);
auditRetentionTimer.unref();
setTimeout(pruneAudit, 60_000).unref();

const shutdown = async (signal) => {
  log("info", "server_stopping", { operation: signal });
  io.close();
  await new Promise((resolve) => server.close(resolve));
  await closePool();
};

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    shutdown(signal).then(() => process.exit(0)).catch(() => process.exit(1));
  });
}

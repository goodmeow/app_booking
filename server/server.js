import config, { validateRuntimeConfig } from "../config/config.js";
import app from "./express.js";
import { Server } from "socket.io";
import webSocket from "./socket/webSocket.js";
import routes from "./routes/index.js";
import { createHttpServer } from "./runtime/create-http-server.js";
import { closePool } from "./db/pool.js";
import { releaseAbandonedBookings } from "./features/events/event.service.js";
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

// Lepas ruangan dari meeting yang tidak check-in sampai batas telat.
const releaseAbandonedTimer = setInterval(async () => {
  try {
    const releasedEventIds = await releaseAbandonedBookings();
    if (releasedEventIds.length) {
      emitEventInvalidation(io, await findEventAudience(releasedEventIds));
    }
  } catch (error) {
    log("error", "auto_release_failed", { message: error.message });
  }
}, 60_000);
releaseAbandonedTimer.unref();

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

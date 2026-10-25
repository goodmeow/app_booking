import assert from "node:assert/strict";
import test from "node:test";
import { io as createClient } from "socket.io-client";
import { targets, withIsolatedTarget } from "./harness.js";

const connectionOutcome = (target) => new Promise((resolve) => {
  const socket = createClient(`http://127.0.0.1:${target.port}`, {
    transports: ["websocket"],
    reconnection: false,
  });
  const finish = (value) => {
    socket.close();
    resolve(value);
  };
  socket.once("connect", () => finish("connected"));
  socket.once("connect_error", () => finish("rejected"));
});

test("Phase 9 intentionally rejects the anonymous socket accepted by legacy", async () => {
  assert.equal(await withIsolatedTarget(targets.legacy, connectionOutcome), "connected");
  assert.equal(await withIsolatedTarget(targets.reconstructed, connectionOutcome), "rejected");
});

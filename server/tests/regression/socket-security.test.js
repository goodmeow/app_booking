import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { io as createClient } from "socket.io-client";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, ids, tokens } from "../parity/fixtures.js";

let server;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
});

after(async () => stopServer(server));

const once = (socket, event, timeout = 1_500) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${event} timeout`)), timeout);
  socket.once(event, (value) => {
    clearTimeout(timer);
    resolve(value);
  });
});

const join = (socket, room) => new Promise((resolve) => socket.emit("room:join", room, resolve));

test("Socket.io rejects anonymous clients and validates room subscriptions", async () => {
  const anonymous = createClient(`http://127.0.0.1:${targets.reconstructed.port}`, {
    transports: ["websocket"],
    reconnection: false,
  });
  const anonymousError = await once(anonymous, "connect_error");
  assert.match(anonymousError.message, /Authentication required/);
  anonymous.close();

  const socket = createClient(`http://127.0.0.1:${targets.reconstructed.port}`, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokens.viewer },
  });
  try {
    await once(socket, "connect");
    assert.deepEqual(await join(socket, "viewer@example.test"), { ok: false });
    assert.deepEqual(await join(socket, "room-one@room.com"), {
      ok: true,
      room: "30000000-0000-4000-8000-000000000001",
    });
  } finally {
    socket.close();
  }
});

test("Socket.io broadcasts invalidations without private settings payloads", async () => {
  const socket = createClient(`http://127.0.0.1:${targets.reconstructed.port}`, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: tokens.viewer },
  });
  try {
    await once(socket, "connect");
    const notification = once(socket, "response:setting");
    const response = await apiRequest(targets.reconstructed, "/api/settings", {
      method: "PUT",
      headers: bearer("admin"),
      body: JSON.stringify({
        id: ids.settings,
        lock_timer: 6,
        led_timer: 7,
        table_input: false,
        not_checked_in_time_limit: 20,
        time_of_event_start_soon: 12,
        available_color: "05",
        will_start_color: "08",
        on_meeting_color: "04",
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await notification, { type: "settings:changed" });
  } finally {
    socket.close();
  }
});

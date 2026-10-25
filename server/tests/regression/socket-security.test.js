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
const leave = (socket, room) => new Promise((resolve) => socket.emit("room:leave", room, resolve));

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
    assert.deepEqual(await leave(socket, "room-one@room.com"), {
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
        self_signup_enabled: false,
        week_start_day: 1,
        backup_enabled: false,
        backup_path: "/backups",
        backup_time: "02:30",
        backup_retention_days: 14,
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await notification, { type: "settings:changed" });
  } finally {
    socket.close();
  }
});

test("Socket.io binds a kiosk token to its own room", async () => {
  const authenticated = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "room-one@room.com", password: "RoomTablet123!" }),
  });
  assert.equal(authenticated.status, 200);
  const socket = createClient(`http://127.0.0.1:${targets.reconstructed.port}`, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: authenticated.body.token },
  });
  try {
    await once(socket, "connect");
    assert.deepEqual(await leave(socket, "room-one@room.com"), { ok: false });
    assert.deepEqual(await join(socket, "room-two@room.com"), { ok: false });
    assert.deepEqual(await join(socket, "room-one@room.com"), {
      ok: true,
      room: "30000000-0000-4000-8000-000000000001",
    });
    const disconnected = once(socket, "disconnect");
    const revoked = await apiRequest(targets.reconstructed, `/api/kiosk/devices/${authenticated.body.device.id}`, {
      method: "DELETE",
      headers: bearer("admin"),
    });
    assert.equal(revoked.status, 200);
    await disconnected;
  } finally {
    socket.close();
  }

  const rejected = createClient(`http://127.0.0.1:${targets.reconstructed.port}`, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: authenticated.body.token },
  });
  const rejectedError = await once(rejected, "connect_error");
  assert.match(rejectedError.message, /Authentication required/);
  rejected.close();
});

test("event invalidations reach only affected room channels", async () => {
  const authenticateRoom = (email, deviceName) => apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "RoomTablet123!", deviceName }),
  });
  const [roomOne, roomTwo] = await Promise.all([
    authenticateRoom("room-one@room.com", "Scoped One"),
    authenticateRoom("room-two@room.com", "Scoped Two"),
  ]);
  const socketOne = createClient(`http://127.0.0.1:${targets.reconstructed.port}`, {
    transports: ["websocket"], reconnection: false, auth: { token: roomOne.body.token },
  });
  const socketTwo = createClient(`http://127.0.0.1:${targets.reconstructed.port}`, {
    transports: ["websocket"], reconnection: false, auth: { token: roomTwo.body.token },
  });
  try {
    await Promise.all([once(socketOne, "connect"), once(socketTwo, "connect")]);
    let unrelatedHits = 0;
    socketTwo.on("response:event", () => { unrelatedHits += 1; });
    const relatedNotification = once(socketOne, "response:event");
    const created = await apiRequest(targets.reconstructed, "/api/events", {
      method: "POST",
      headers: bearer("admin"),
      body: JSON.stringify([
        { organizer: "admin@example.test", subject: "Scoped socket", description: "", start_date: "2032-01-15T03:00:00.000Z", end_date: "2032-01-15T04:00:00.000Z", attendee_email: "admin@example.test" },
        { organizer: "admin@example.test", subject: "Scoped socket", description: "", start_date: "2032-01-15T03:00:00.000Z", end_date: "2032-01-15T04:00:00.000Z", attendee_email: "room-one@room.com" },
      ]),
    });
    assert.equal(created.status, 200);
    assert.deepEqual(await relatedNotification, { type: "events:changed" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(unrelatedHits, 0);
  } finally {
    socketOne.close();
    socketTwo.close();
  }
});

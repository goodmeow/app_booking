import assert from "node:assert/strict";
import test from "node:test";
import { io as createClient } from "socket.io-client";
import { apiRequest, targets, withIsolatedTarget } from "./harness.js";
import { bearer, ids } from "./fixtures.js";

function receiveOnce(socket, eventName, timeoutMs = 1_500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${eventName} timeout`)), timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function socketSettingsScenario(target) {
  const socket = createClient(`http://127.0.0.1:${target.port}`, {
    transports: ["websocket"],
    reconnection: false,
  });

  try {
    await receiveOnce(socket, "connect");
    socket.emit("room:join", "room-one@room.com");
    await new Promise((resolve) => setTimeout(resolve, 100));

    const eventPromise = receiveOnce(socket, "response:setting");
    const payload = {
      id: ids.settings,
      lock_timer: 6,
      led_timer: 7,
      table_input: false,
      not_checked_in_time_limit: 20,
      time_of_event_start_soon: 12,
      available_color: "05",
      will_start_color: "08",
      on_meeting_color: "04",
    };
    const response = await apiRequest(target, "/api/settings", {
      method: "PUT",
      headers: bearer("user"),
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 200);
    return { event: await eventPromise, response: response.body };
  } finally {
    socket.removeAllListeners();
    socket.close();
  }
}

test("unauthenticated room join and settings broadcast match", async () => {
  const legacy = await withIsolatedTarget(targets.legacy, socketSettingsScenario);
  const reconstructed = await withIsolatedTarget(
    targets.reconstructed,
    socketSettingsScenario
  );
  assert.deepEqual(legacy, reconstructed);
});

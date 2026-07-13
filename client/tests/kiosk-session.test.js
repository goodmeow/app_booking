import assert from "node:assert/strict";
import { test } from "node:test";
import { clearKioskSession, kioskSessionKey, readKioskSession, saveKioskSession } from "../kiosk/kiosk-session.js";

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const session = (refreshExpiresAt) => ({
  token: "access-token",
  refreshToken: "refresh-token",
  room: { _id: "room-1" },
  device: { id: "device-1", refreshExpiresAt: new Date(refreshExpiresAt).toISOString() },
});

test("kiosk session survives access expiry and expires with refresh credential", () => {
  const target = storage();
  const now = Date.now();
  const stored = session(now + 60_000);
  saveKioskSession(stored, target);
  assert.deepEqual(readKioskSession(target, now), stored);
  assert.equal(readKioskSession(target, now + 120_000), null);
  assert.equal(target.getItem(kioskSessionKey), null);
});

test("kiosk session can be deprovisioned", () => {
  const target = storage();
  saveKioskSession(session(Date.now() + 60_000), target);
  clearKioskSession(target);
  assert.equal(readKioskSession(target), null);
});

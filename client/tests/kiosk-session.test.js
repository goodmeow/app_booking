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

const token = (expiresAt) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiresAt / 1000), kind: "kiosk" })).toString("base64url");
  return `header.${payload}.signature`;
};

test("kiosk session persists independently and expires locally", () => {
  const target = storage();
  const now = Date.now();
  const session = { token: token(now + 60_000), room: { _id: "room-1" } };
  saveKioskSession(session, target);
  assert.deepEqual(readKioskSession(target, now), session);
  assert.equal(readKioskSession(target, now + 120_000), null);
  assert.equal(target.getItem(kioskSessionKey), null);
});

test("kiosk session can be deprovisioned", () => {
  const target = storage();
  saveKioskSession({ token: token(Date.now() + 60_000), room: { _id: "room-1" } }, target);
  clearKioskSession(target);
  assert.equal(readKioskSession(target), null);
});

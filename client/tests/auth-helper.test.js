import assert from "node:assert/strict";
import test from "node:test";
import { isRoomAccountEmail, signout } from "../auth/auth-helper.js";

test("rejects room account email case-insensitively", () => {
  assert.equal(isRoomAccountEmail("meeting@room.com"), true);
  assert.equal(isRoomAccountEmail("MEETING@ROOM.COM"), true);
  assert.equal(isRoomAccountEmail("user@example.test"), false);
});

test("signout clears local auth and navigates before the network resolves", async () => {
  const originalWindow = globalThis.window;
  const originalSessionStorage = globalThis.sessionStorage;
  const originalFetch = globalThis.fetch;
  const calls = [];
  let resolveFetch;

  globalThis.window = {};
  globalThis.sessionStorage = { removeItem: (key) => calls.push(`remove:${key}`) };
  globalThis.fetch = () => {
    calls.push("fetch");
    return new Promise((resolve) => { resolveFetch = resolve; });
  };

  try {
    const request = signout(() => calls.push("navigate"));
    assert.deepEqual(calls, ["remove:jwt", "navigate", "fetch"]);
    resolveFetch({ ok: true });
    await request;
  } finally {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalSessionStorage;
    globalThis.fetch = originalFetch;
  }
});

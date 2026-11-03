import assert from "node:assert/strict";
import test from "node:test";
import { clearStoredSession, isAuthenticated, readStoredSession, signin, signout, signup } from "../auth/auth-helper.js";
import i18n from "../i18n/index.js";

test("auth errors prefer localized stable codes over server text", async () => {
  const originalFetch = globalThis.fetch;
  const originalLanguage = i18n.resolvedLanguage || i18n.language;
  const responses = [
    { code: "INVALID_CREDENTIALS", error: "Invalid login or password" },
    { code: "IDENTITY_EXISTS", error: "Email or username already exists" },
    { code: "CORS_ORIGIN", error: "Origin is not allowed" },
  ];

  globalThis.fetch = async () => ({
    ok: false,
    json: async () => responses.shift(),
  });

  try {
    await i18n.changeLanguage("id");
    await assert.rejects(
      signin({ login: "test", password: "wrong" }),
      { message: "Login atau kata sandi tidak valid" },
    );
    await assert.rejects(
      signup({ email: "used@example.com" }),
      { message: "Email atau nama pengguna sudah terdaftar" },
    );
    await assert.rejects(
      signin({ email: "test@example.com", password: "secret" }),
      { message: "Alamat browser ini belum diizinkan server. Hubungi admin." },
    );
  } finally {
    await i18n.changeLanguage(originalLanguage);
    globalThis.fetch = originalFetch;
  }
});

test("blocked browser storage is treated as no session", () => {
  const originalWindow = globalThis.window;
  const originalSessionStorage = globalThis.sessionStorage;
  const originalLocalStorage = globalThis.localStorage;
  const blocked = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };

  globalThis.window = { sessionStorage: blocked, localStorage: blocked };
  globalThis.sessionStorage = blocked;
  globalThis.localStorage = blocked;
  try {
    assert.equal(readStoredSession(), null);
    assert.equal(isAuthenticated(), false);
    assert.doesNotThrow(() => clearStoredSession());
  } finally {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalSessionStorage;
    globalThis.localStorage = originalLocalStorage;
  }
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

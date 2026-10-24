import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildSetupPayload, validateSetupForm } from "../domain/setup.js";

const readClientFile = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const readLocale = (language, namespace) => JSON.parse(
  fs.readFileSync(new URL(`../locales/${language}/${namespace}.json`, import.meta.url), "utf8")
);

test("setup form rejects an empty name, empty email, short password, and mismatch", () => {
  const valid = {
    name: "Admin",
    email: "admin@example.com",
    password: "secret123",
    confirm: "secret123",
  };

  assert.equal(validateSetupForm(valid), null);
  assert.equal(validateSetupForm({ ...valid, name: "   " }), "nameRequired");
  assert.equal(validateSetupForm({ ...valid, email: " " }), "emailRequired");
  assert.equal(validateSetupForm({ ...valid, password: "short", confirm: "short" }), "passwordTooShort");
  assert.equal(validateSetupForm({ ...valid, confirm: "different" }), "passwordMismatch");
  assert.equal(validateSetupForm(), "nameRequired");
});

test("setup payload trims text and omits an empty employee ID", () => {
  assert.deepEqual(
    buildSetupPayload({
      name: "  Admin  ",
      email: " admin@example.com ",
      employeeId: "  ",
      password: "secret123",
      confirm: "secret123",
    }),
    { name: "Admin", email: "admin@example.com", password: "secret123" }
  );
  assert.equal(
    buildSetupPayload({ name: "Admin", email: "a@b.c", employeeId: " EMP-9 ", password: "secret123" }).employeeId,
    "EMP-9"
  );
});

test("MainRouter registers the setup route and hides chrome for it", () => {
  const router = readClientFile("MainRouter.js");

  assert.match(router, /import \{ SetupGate, SetupRoute \} from "\.\/auth\/SetupGate\.js"/);
  assert.match(router, /<Route path="\/setup" component=\{SetupRoute\} \/>/);
  assert.match(router, /<SetupGate>/);
  assert.match(router, /if \(location\.pathname === "\/setup"\) return null;/);
});

test("setup gate redirects both ways without a loop", () => {
  const gate = readClientFile("auth/SetupGate.js");

  // Ordinary pages go to /setup while setup is required...
  assert.match(gate, /if \(data\?\.required\) \{/);
  assert.match(gate, /pathname: "\/setup"/);
  // ...and a finished installation sends /setup back to sign in.
  assert.match(gate, /if \(data\?\.required === false\) return <Redirect to="\/signin" \/>;/);
  // The setup page itself is exempt from the gate, which would otherwise loop.
  assert.match(gate, /if \(location\.pathname === "\/setup"\) return children;/);
  // A failing status endpoint keeps the page usable with a retry action.
  assert.match(gate, /t\("auth:setup\.statusError"\)/);
  assert.match(gate, /refetch\(\)/);
});

test("setup API service uses the public status and submit endpoints", () => {
  const service = readClientFile("redux/services/setup.js");

  assert.match(service, /query: \(\) => "setup\/status"/);
  assert.match(service, /url: "setup", method: "POST"/);
  assert.match(service, /providesTags: \["setupStatus"\]/);
  assert.match(readClientFile("redux/store.js"), /import "\.\/services\/setup\.js";/);
  assert.match(readClientFile("redux/api.js"), /"setupStatus"/);
});

test("sign in page announces a completed setup", () => {
  const signin = readClientFile("auth/Signin.js");

  assert.match(signin, /location\.state\?\.setupComplete/);
  assert.match(signin, /t\("auth:setup\.success"\)/);
  const setup = readClientFile("auth/InitialSetup.js");
  assert.match(setup, /await signin\(/);
  assert.match(setup, /authenticate\(session/);
  assert.match(setup, /window\.location\.assign\("\/"\)/);
});

test("setup translations exist in both languages with matching interpolation", () => {
  const setupKeys = [
    "title",
    "intro",
    "name",
    "email",
    "employeeId",
    "employeeIdHelp",
    "password",
    "passwordRule",
    "confirm",
    "submit",
    "loading",
    "success",
    "statusError",
    "errors.nameRequired",
    "errors.emailRequired",
    "errors.passwordTooShort",
    "errors.passwordMismatch",
    "errors.generic",
  ];

  for (const language of ["en", "id"]) {
    const auth = readLocale(language, "auth");
    for (const key of setupKeys) {
      const value = key.split(".").reduce((node, part) => node?.[part], auth.setup);
      assert.equal(typeof value, "string", `${language}:auth.setup.${key}`);
      assert.notEqual(value.trim(), "", `${language}:auth.setup.${key} empty`);
      assert.equal((value.match(/{{\s*[^}]+}}/g) || []).length, 0, `${language}:auth.setup.${key} interpolation`);
    }
  }

  const enErrors = readLocale("en", "common").apiErrors;
  const idErrors = readLocale("id", "common").apiErrors;
  assert.equal(typeof enErrors.employeeIdExists, "string");
  assert.equal(typeof enErrors.setupCompleted, "string");
  assert.equal(typeof idErrors.employeeIdExists, "string");
  assert.equal(typeof idErrors.setupCompleted, "string");
  assert.deepEqual(
    Object.keys(idErrors).sort(),
    Object.keys(enErrors).sort(),
    "common:apiErrors parity"
  );
});

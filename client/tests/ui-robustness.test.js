import assert from "node:assert/strict";
import test from "node:test";
import { stateFromError, stateFromProps } from "../components/common/error-boundary-state.js";
import { hasFloor } from "../management/user-form.js";
import { brandShowsName, brandHasLockup, signinLogoSource } from "../core/brand-assets.js";

test("hasFloor treats empty and whitespace floors as unset", () => {
  assert.equal(hasFloor({ floor: "3" }), true);
  assert.equal(hasFloor({ floor: "all" }), true);
  assert.equal(hasFloor({ floor: "" }), false);
  assert.equal(hasFloor({ floor: "  " }), false);
  assert.equal(hasFloor({ floor: null }), false);
  assert.equal(hasFloor({}), false);
});

test("error boundary state captures errors and resets when the route key changes", () => {
  const error = new Error("boom");
  assert.deepEqual(stateFromError(error), { error });
  assert.equal(stateFromProps({ resetKey: "/a" }, { error, resetKey: "/a" }), null);
  assert.deepEqual(stateFromProps({ resetKey: "/b" }, { error, resetKey: "/a" }), { error: null, resetKey: "/b" });
});

test("navbar shows the brand text only while the custom assets are incomplete", () => {
  assert.equal(brandShowsName({ assets: { mark: "/mark.png", wordmark: "/wordmark.png" } }), false);
  assert.equal(brandShowsName({ assets: { mark: "/mark.png" } }), true);
  assert.equal(brandShowsName({ assets: { wordmark: "/wordmark.png" } }), true);
  assert.equal(brandShowsName({ assets: {} }), true);
  assert.equal(brandShowsName(undefined), true);
});

test("custom brand lockup needs both assets", () => {
  assert.equal(brandHasLockup({ assets: { mark: "/m.png", wordmark: "/w.png" } }), true);
  assert.equal(brandHasLockup({ assets: { mark: "/m.png" } }), false);
  assert.equal(brandHasLockup({ assets: {} }), false);
  assert.equal(brandHasLockup(undefined), false);
});

test("sign-in logo follows the surface: colour on light, white on dark", () => {
  assert.equal(signinLogoSource("dark"), "/the-prasada-logo.png");
  assert.equal(signinLogoSource("light"), "/the-prasada-logo-colour.png");
});

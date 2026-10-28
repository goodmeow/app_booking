import assert from "node:assert/strict";
import { test } from "node:test";
import { isPlaceholderSecret } from "../../../config/config.js";

test("example secrets are rejected before the server starts", () => {
  assert.equal(isPlaceholderSecret("<at-least-32-character-random-secret>"), true);
  assert.equal(isPlaceholderSecret("change-me"), true);
  assert.equal(isPlaceholderSecret("your_secret"), true);
  assert.equal(isPlaceholderSecret("a-real-random-value-with-enough-length"), false);
});

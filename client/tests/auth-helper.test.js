import assert from "node:assert/strict";
import test from "node:test";
import { isRoomAccountEmail } from "../auth/auth-helper.js";

test("rejects room account email case-insensitively", () => {
  assert.equal(isRoomAccountEmail("meeting@room.com"), true);
  assert.equal(isRoomAccountEmail("MEETING@ROOM.COM"), true);
  assert.equal(isRoomAccountEmail("user@example.test"), false);
});

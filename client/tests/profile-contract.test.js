import assert from "node:assert/strict";
import test from "node:test";
import { canManageProfile, formatJoinedDate } from "../domain/profile.js";

test("allows profile mutations only for session owner", () => {
  const session = { user: { _id: "user-1" } };
  assert.equal(canManageProfile(session, "user-1"), true);
  assert.equal(canManageProfile(session, "user-2"), false);
  assert.equal(canManageProfile(false, "user-1"), false);
});

test("formats joined date with recovered Date.toDateString contract", () => {
  assert.equal(formatJoinedDate(new Date(2030, 0, 15)), "Tue Jan 15 2030");
  assert.equal(formatJoinedDate("invalid"), "-");
});

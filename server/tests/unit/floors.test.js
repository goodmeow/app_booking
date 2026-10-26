import assert from "node:assert/strict";
import { test } from "node:test";
import { coversAnyFloor, coversFloor, effectiveFloors } from "../../lib/floors.js";

test("legacy floor and the new floors list resolve to the same scope", () => {
  assert.deepEqual(effectiveFloors({ floor: "3" }), ["3"]);
  assert.deepEqual(effectiveFloors({ floor: "3", floors: ["5", "6"] }), ["5", "6"]);
  assert.equal(coversFloor({ floors: ["5", "6"] }, "6"), true);
  assert.equal(coversFloor({ floors: ["5", "6"] }, "3"), false);
});

test("the all group covers every floor", () => {
  assert.equal(coversFloor({ floors: ["all"] }, "7"), true);
  assert.equal(coversAnyFloor({ floor: "all" }, ["1", "7"]), true);
});

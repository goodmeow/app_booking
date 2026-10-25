import assert from "node:assert/strict";
import { test } from "node:test";
import { publicEmployee } from "../../features/users/user.service.js";

test("the user list for non-admins does not include card credentials", () => {
  const row = {
    _id: "1",
    name: "A",
    email: "a@x.test",
    username: "a",
    employee_id: "EMP-1",
    type: "employee",
    card_number: "04AABBCC",
    cards: [{ id: "card-1", card_number: "04AABBCC", status: "active" }],
    floor: "3",
    is_master_card: true,
  };
  const result = publicEmployee(row);
  assert.deepEqual(Object.keys(result).sort(), ["_id", "email", "name", "type", "username"]);
});

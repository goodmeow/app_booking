import assert from "node:assert/strict";
import test from "node:test";
import { currentMonthRange, formatDateDDMMYYYY, reportFilename } from "../domain/dates.js";

test("builds inclusive current-month range", () => {
  const range = currentMonthRange(new Date("2030-02-12T12:00:00"));
  assert.equal(formatDateDDMMYYYY(range.start), "01-02-2030");
  assert.equal(formatDateDDMMYYYY(range.end), "28-02-2030");
});

test("builds recovered report filename", () => {
  assert.equal(
    reportFilename(new Date("2030-01-01T00:00:00"), new Date("2030-01-31T00:00:00")),
    "History Meeting Report (01-01-2030 - 31-01-2030).xlsx"
  );
});

test("rejects invalid report dates", () => {
  assert.throws(() => formatDateDDMMYYYY("not-a-date"), /Invalid date/);
});

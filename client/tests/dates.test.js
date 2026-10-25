import assert from "node:assert/strict";
import test from "node:test";
import { currentMonthRange, formatDateDDMMMYYYY, formatDateDDMMYYYY, formatDateLong, formatDateTimeLong, formatDateYYYYMMDD, isValidDateRange, reportFilename } from "../domain/dates.js";

test("builds inclusive current-month range", () => {
  const range = currentMonthRange(new Date("2030-02-12T12:00:00"));
  assert.equal(formatDateDDMMYYYY(range.start), "01-02-2030");
  assert.equal(formatDateDDMMYYYY(range.end), "28-02-2030");
});

test("builds localized report filenames", () => {
  assert.equal(
    reportFilename(new Date("2030-01-01T00:00:00"), new Date("2030-01-31T00:00:00"), "en"),
    "Meeting History Report (01-01-2030 - 31-01-2030).xlsx"
  );
  assert.equal(
    reportFilename(new Date("2030-01-01T00:00:00"), new Date("2030-01-31T00:00:00"), "id"),
    "Laporan Riwayat Meeting (01-01-2030 - 31-01-2030).xlsx"
  );
});

test("rejects invalid report dates", () => {
  assert.throws(() => formatDateDDMMYYYY("not-a-date"), /Invalid date/);
});

test("formats report query dates and validates range", () => {
  assert.equal(formatDateYYYYMMDD(new Date(2030, 0, 5)), "2030-01-05");
  assert.equal(isValidDateRange("2030-01-01", "2030-01-31"), true);
  assert.equal(isValidDateRange("2030-02-01", "2030-01-31"), false);
});

test("formats report timestamps for English and Indonesian", () => {
  const date = new Date(2030, 0, 15, 9, 5, 7);
  assert.equal(formatDateDDMMMYYYY(date, "en"), "15-Jan-2030");
  assert.equal(formatDateDDMMMYYYY(date, "id"), "15-Jan-2030");
  assert.equal(formatDateLong(date, "en"), "15 January 2030");
  assert.equal(formatDateTimeLong(date, "en"), "15 January 2030 at 09:05:07");
  assert.equal(formatDateLong(date, "id"), "15 Januari 2030");
  assert.equal(formatDateTimeLong(date, "id"), "15 Januari 2030 pukul 09.05.07");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../../../config/config.js";
import { calendarRange } from "../../features/events/event.service.js";

const timezone = "Asia/Jakarta";

test("rentang satu bulan dan satu tahun penuh diterima", () => {
  assert.doesNotThrow(() => calendarRange("20300101", "20300131", timezone));
  assert.doesNotThrow(() => calendarRange("20300101", "20301231", timezone));
});

test("rentang melebihi batas konfigurasi ditolak", () => {
  assert.equal(config.maxCalendarRangeDays, 366);
  assert.throws(
    () => calendarRange("20300101", "20310102", timezone),
    (error) => error.status === 400 && error.code === "RANGE_TOO_LARGE"
  );
  assert.throws(
    () => calendarRange("20000101", "20991231", timezone),
    (error) => error.code === "RANGE_TOO_LARGE"
  );
});

test("batas maksimum menghitung kedua tanggal ujung", () => {
  assert.doesNotThrow(() => calendarRange("20280101", "20281231", timezone));
  assert.throws(
    () => calendarRange("20280101", "20290101", timezone),
    (error) => error.code === "RANGE_TOO_LARGE"
  );
});

test("tanggal salah format atau tidak ada tetap INVALID_RANGE", () => {
  assert.throws(() => calendarRange("2030-01-01", "20300131", timezone), (error) => error.code === "INVALID_RANGE");
  assert.throws(() => calendarRange("20300230", "20300301", timezone), (error) => error.code === "INVALID_RANGE");
});

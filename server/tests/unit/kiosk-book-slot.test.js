import assert from "node:assert/strict";
import { test } from "node:test";
import { validateKioskBookedSlot } from "../../features/kiosk/kiosk.service.js";

// Zona server Asia/Jakarta: 10:00 WIB = 03:00 UTC.
const timezone = "Asia/Jakarta";
const now = new Date("2032-03-10T03:00:00.000Z");

test("slot hari ini yang valid diterima dan ditandai mulai sekarang", () => {
  const slot = validateKioskBookedSlot({
    now,
    start: "2032-03-10T03:01:00.000Z",
    end: "2032-03-10T04:01:00.000Z",
    timezone,
  });
  assert.equal(slot.startDate.toISOString(), "2032-03-10T03:01:00.000Z");
  assert.equal(slot.endDate.toISOString(), "2032-03-10T04:01:00.000Z");
  assert.equal(slot.startsNow, true);
});

test("slot yang mulai belakangan tidak langsung check-in", () => {
  const slot = validateKioskBookedSlot({
    now,
    start: "2032-03-10T09:00:00.000Z", // 16:00 WIB, masih hari yang sama
    end: "2032-03-10T10:00:00.000Z",
    timezone,
  });
  assert.equal(slot.startsNow, false);
});

test("menolak waktu mulai yang sudah lewat", () => {
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T02:30:00.000Z",
      end: "2032-03-10T03:30:00.000Z",
      timezone,
    }),
    /sudah lewat/,
  );
});

test("menolak slot yang melewati akhir hari zona server", () => {
  // 23:30 WIB sampai 00:30 WIB besoknya.
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T16:30:00.000Z",
      end: "2032-03-10T17:30:00.000Z",
      timezone,
    }),
    /hanya untuk hari ini/,
  );
});

test("menolak durasi kurang dari 5 menit atau lebih dari 4 jam", () => {
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T04:00:00.000Z",
      end: "2032-03-10T04:03:00.000Z",
      timezone,
    }),
    /5-240 menit/,
  );
  assert.throws(
    () => validateKioskBookedSlot({
      now,
      start: "2032-03-10T04:00:00.000Z",
      end: "2032-03-10T09:00:00.000Z",
      timezone,
    }),
    /5-240 menit/,
  );
});

test("menolak waktu yang tidak valid", () => {
  assert.throws(
    () => validateKioskBookedSlot({ now, start: "bukan-tanggal", end: "2032-03-10T04:00:00.000Z", timezone }),
    /wajib diisi/,
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { instantBookingWindow } from "../../features/kiosk/kiosk.service.js";

const timezone = "Asia/Jakarta";

test("instant 30 menit berakhir di hari yang sama", () => {
  const now = new Date("2031-05-09T16:50:00.000Z"); // 23:50 Jakarta
  const window = instantBookingWindow({ now, minutes: 30, timezone });
  assert.equal(window.end.toISOString(), "2031-05-09T16:59:59.000Z"); // 23:59:59 Jakarta
  assert.equal(window.untilNext, false);
});

test("meeting berikutnya besok tidak memperpanjang instant melewati tengah malam", () => {
  const now = new Date("2031-05-09T16:50:00.000Z");
  const window = instantBookingWindow({
    now,
    nextStart: "2031-05-09T17:30:00.000Z", // 00:30 Jakarta, hari berikutnya
    minutes: 30,
    timezone,
  });
  assert.equal(window.untilNext, false);
  assert.equal(window.end.toISOString(), "2031-05-09T16:59:59.000Z");
});

test("meeting berikutnya di hari yang sama tetap dipakai sebagai batas", () => {
  const now = new Date("2031-05-09T10:00:00.000Z"); // 17:00 Jakarta
  const next = "2031-05-09T11:00:00.000Z"; // 18:00 Jakarta
  const window = instantBookingWindow({ now, nextStart: next, minutes: 240, timezone });
  assert.equal(window.untilNext, true);
  assert.equal(window.end.toISOString(), next);
});

test("durasi dibatasi minimal 5 menit dan maksimal 240 menit", () => {
  const now = new Date("2031-05-09T03:00:00.000Z"); // 10:00 Jakarta
  assert.equal(
    instantBookingWindow({ now, minutes: 1, timezone }).end.toISOString(),
    "2031-05-09T03:05:00.000Z"
  );
  assert.equal(
    instantBookingWindow({ now, minutes: 999, timezone }).end.toISOString(),
    "2031-05-09T07:00:00.000Z"
  );
});

test("sisa waktu kurang dari satu menit terdeteksi oleh pemanggil", () => {
  const now = new Date("2031-05-09T16:59:30.000Z"); // 23:59:30 Jakarta
  const window = instantBookingWindow({ now, minutes: 30, timezone });
  assert.ok(window.end.getTime() - now.getTime() < 60_000);
});

test("durasi yang diminta dihormati meski meeting berikutnya masih jauh", () => {
  const now = new Date("2031-05-09T03:00:00.000Z"); // 10:00 Jakarta
  const window = instantBookingWindow({ now, nextStart: "2031-05-09T10:00:00.000Z", minutes: 30, timezone });
  assert.equal(window.end.toISOString(), "2031-05-09T03:30:00.000Z");
  assert.equal(window.untilNext, false);
});

test("meeting berikutnya memotong durasi yang melewatinya", () => {
  const now = new Date("2031-05-09T03:00:00.000Z");
  const next = "2031-05-09T03:20:00.000Z";
  const window = instantBookingWindow({ now, nextStart: next, minutes: 60, timezone });
  assert.equal(window.end.toISOString(), next);
  assert.equal(window.untilNext, true);
});

test("until_next memakai meeting berikutnya sebagai akhir", () => {
  const now = new Date("2031-05-09T03:00:00.000Z");
  const next = "2031-05-09T06:00:00.000Z";
  const window = instantBookingWindow({ now, nextStart: next, minutes: 30, untilNext: true, timezone });
  assert.equal(window.end.toISOString(), next);
  assert.equal(window.untilNext, true);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { kioskCapabilityFlags, publicKioskDevice } from "../../features/kiosk/kiosk.service.js";

const deviceRow = {
  device_id: "10000000-0000-4000-8000-000000000001",
  device_name: "Tablet",
  room_id: "10000000-0000-4000-8000-000000000002",
  room_name: "Room",
  room_email: "room@example.test",
  instant_enabled: true,
  schedule_enabled: false,
};

test("instant and schedule toggles are accepted as booleans", () => {
  const flags = kioskCapabilityFlags({ instantEnabled: false, scheduleEnabled: true });
  assert.equal(flags.instantEnabled, false);
  assert.equal(flags.scheduleEnabled, true);
});

test("a setting left out of the body stays null so the stored value is kept", () => {
  const flags = kioskCapabilityFlags({ instantEnabled: true });
  assert.equal(flags.instantEnabled, true);
  assert.equal(flags.nfcEnabled, null);
  assert.equal(flags.ledEnabled, null);
  assert.equal(flags.showSubject, null);
  assert.equal(flags.scheduleEnabled, null);
});

test("rejects a non-boolean instant or schedule setting", () => {
  assert.throws(() => kioskCapabilityFlags({ instantEnabled: "yes" }), /instantEnabled setting must be boolean/);
  assert.throws(() => kioskCapabilityFlags({ scheduleEnabled: 1 }), /scheduleEnabled setting must be boolean/);
});

test("rejects an empty capability body and mentions the new settings", () => {
  assert.throws(() => kioskCapabilityFlags({}), /instant booking, or schedule booking setting is required/);
});

test("the public device mapping exposes both action toggles", () => {
  const device = publicKioskDevice(deviceRow);
  assert.equal(device.instantEnabled, true);
  assert.equal(device.scheduleEnabled, false);
});

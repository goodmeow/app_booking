import assert from "node:assert/strict";
import test from "node:test";
import {
  settingsFormErrorKey,
  settingsFormFrom,
  settingsPayload,
  SETTINGS_NUMBER_FIELDS,
} from "../management/settings-form.js";

const settings = {
  _id: "s1",
  lock_timer: 5,
  led_timer: 5,
  table_input: true,
  not_checked_in_time_limit: 15,
  time_of_event_start_soon: 10,
  available_color: "05",
  will_start_color: "08",
  on_meeting_color: "04",
  self_signup_enabled: false,
  week_start_day: 1,
  backup_enabled: false,
  backup_path: '/backups',
  backup_time: '02:30',
  backup_retention_days: 14,
};

const validForm = settingsFormFrom(settings);

test("settings form turns timer numbers into strings and keeps booleans", () => {
  assert.equal(validForm.not_checked_in_time_limit, "15");
  assert.equal(validForm.time_of_event_start_soon, "10");
  assert.equal(validForm.lock_timer, "5");
  assert.equal(validForm.led_timer, "5");
  assert.equal(validForm.table_input, true);
  assert.equal(validForm.self_signup_enabled, false);
  assert.equal(validForm.week_start_day, "1");
  assert.equal(validForm.backup_enabled, false);
  assert.equal(validForm.backup_path, "/backups");
  assert.equal(validForm.backup_time, "02:30");
  assert.equal(validForm.backup_retention_days, "14");
  assert.deepEqual(settingsFormFrom(null), {
    table_input: false,
    self_signup_enabled: false,
    week_start_day: "1",
    backup_enabled: false,
    backup_path: "/backups",
    backup_time: "02:30",
    backup_retention_days: "14",
    not_checked_in_time_limit: "",
    time_of_event_start_soon: "",
    lock_timer: "",
    led_timer: "",
  });
});

test("settings form rejects empty, zero, negative, and fractional timers", () => {
  assert.equal(settingsFormErrorKey(validForm), null);
  for (const field of SETTINGS_NUMBER_FIELDS) {
    assert.equal(settingsFormErrorKey({ ...validForm, [field]: "" }), "settings.invalidNumber");
    assert.equal(settingsFormErrorKey({ ...validForm, [field]: "0" }), "settings.invalidNumber");
    assert.equal(settingsFormErrorKey({ ...validForm, [field]: "-3" }), "settings.invalidNumber");
    assert.equal(settingsFormErrorKey({ ...validForm, [field]: "2.5" }), "settings.invalidNumber");
    assert.equal(settingsFormErrorKey({ ...validForm, [field]: "abc" }), "settings.invalidNumber");
    assert.equal(settingsFormErrorKey({ ...validForm, [field]: "1" }), null);
  }
  assert.equal(settingsFormErrorKey({ ...validForm, week_start_day: "7" }), "settings.invalidWeekStart");
  assert.equal(settingsFormErrorKey({ ...validForm, week_start_day: "0" }), null);
  assert.equal(settingsFormErrorKey({ ...validForm, backup_path: "relative" }), "settings.invalidBackupPath");
  assert.equal(settingsFormErrorKey({ ...validForm, backup_time: "25:00" }), "settings.invalidBackupTime");
  assert.equal(settingsFormErrorKey({ ...validForm, backup_retention_days: "0" }), "settings.invalidBackupRetention");
});

test("settings payload keeps untouched fields and converts the edited ones", () => {
  const payload = settingsPayload(settings, {
    ...validForm,
    lock_timer: "7",
    table_input: false,
    self_signup_enabled: true,
    week_start_day: "0",
    backup_enabled: true,
    backup_path: "/backups/uat",
    backup_time: "03:15",
    backup_retention_days: "30",
  });

  assert.equal(payload.id, "s1");
  assert.equal(payload._id, "s1");
  assert.equal(payload.lock_timer, 7);
  assert.equal(payload.not_checked_in_time_limit, 15);
  assert.equal(payload.time_of_event_start_soon, 10);
  assert.equal(payload.table_input, false);
  assert.equal(payload.self_signup_enabled, true);
  assert.equal(payload.week_start_day, 0);
  assert.equal(payload.backup_enabled, true);
  assert.equal(payload.backup_path, "/backups/uat");
  assert.equal(payload.backup_time, "03:15");
  assert.equal(payload.backup_retention_days, 30);
  // Colour fields are not edited by this screen but must still be sent.
  assert.equal(payload.available_color, "05");
  assert.equal(payload.will_start_color, "08");
  assert.equal(payload.on_meeting_color, "04");
});

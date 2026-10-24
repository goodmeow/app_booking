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
};

const validForm = settingsFormFrom(settings);

test("settings form turns timer numbers into strings and keeps booleans", () => {
  assert.equal(validForm.not_checked_in_time_limit, "15");
  assert.equal(validForm.time_of_event_start_soon, "10");
  assert.equal(validForm.lock_timer, "5");
  assert.equal(validForm.led_timer, "5");
  assert.equal(validForm.table_input, true);
  assert.equal(validForm.self_signup_enabled, false);
  assert.deepEqual(settingsFormFrom(null), {
    table_input: false,
    self_signup_enabled: false,
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
});

test("settings payload keeps untouched fields and converts the edited ones", () => {
  const payload = settingsPayload(settings, {
    ...validForm,
    lock_timer: "7",
    table_input: false,
    self_signup_enabled: true,
  });

  assert.equal(payload.id, "s1");
  assert.equal(payload._id, "s1");
  assert.equal(payload.lock_timer, 7);
  assert.equal(payload.not_checked_in_time_limit, 15);
  assert.equal(payload.time_of_event_start_soon, 10);
  assert.equal(payload.table_input, false);
  assert.equal(payload.self_signup_enabled, true);
  // Colour fields are not edited by this screen but must still be sent.
  assert.equal(payload.available_color, "05");
  assert.equal(payload.will_start_color, "08");
  assert.equal(payload.on_meeting_color, "04");
});

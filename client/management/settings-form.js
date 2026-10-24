// The settings row mixes numeric timers with booleans. The form edits them as
// strings (MUI text fields) and this module converts back to the server shape.

export const SETTINGS_NUMBER_FIELDS = [
  "not_checked_in_time_limit",
  "time_of_event_start_soon",
  "lock_timer",
  "led_timer",
];

export const settingsFormFrom = (settings) => {
  const form = {
    table_input: settings?.table_input === true,
    self_signup_enabled: settings?.self_signup_enabled === true,
  };
  for (const field of SETTINGS_NUMBER_FIELDS) {
    const value = settings?.[field];
    form[field] = value === undefined || value === null ? "" : String(value);
  }
  return form;
};

// Returns the management locale key of the problem, or null when every timer
// is a whole number above zero.
export const settingsFormErrorKey = (form) => {
  for (const field of SETTINGS_NUMBER_FIELDS) {
    const raw = String(form?.[field] ?? "").trim();
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) return "settings.invalidNumber";
  }
  return null;
};

// The server requires the full settings row, so keep the loaded values and only
// replace the fields the form owns.
export const settingsPayload = (settings, form) => {
  const payload = {
    ...settings,
    id: settings?._id || settings?.id,
    table_input: form?.table_input === true,
    self_signup_enabled: form?.self_signup_enabled === true,
  };
  for (const field of SETTINGS_NUMBER_FIELDS) {
    payload[field] = Number(form?.[field]);
  }
  return payload;
};

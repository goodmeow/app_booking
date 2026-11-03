// The settings row mixes numeric timers with booleans. The form edits them as
// strings (Ant Design inputs) and this module converts back to the server shape.

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
    week_start_day: String(settings?.week_start_day ?? 1),
    backup_enabled: settings?.backup_enabled === true,
    backup_path: settings?.backup_path || "/backups",
    backup_time: settings?.backup_time || "02:30",
    backup_retention_days: String(settings?.backup_retention_days ?? 14),
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
  const weekStart = Number(form?.week_start_day);
  if (!Number.isInteger(weekStart) || weekStart < 0 || weekStart > 6) {
    return "settings.invalidWeekStart";
  }
  if (!String(form?.backup_path || "").startsWith("/")) return "settings.invalidBackupPath";
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(form?.backup_time || ""))) {
    return "settings.invalidBackupTime";
  }
  const retention = Number(form?.backup_retention_days);
  if (!Number.isInteger(retention) || retention < 1 || retention > 365) {
    return "settings.invalidBackupRetention";
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
  payload.week_start_day = Number(form?.week_start_day);
  payload.backup_enabled = form?.backup_enabled === true;
  payload.backup_path = String(form?.backup_path || "/backups").trim();
  payload.backup_time = String(form?.backup_time || "02:30").trim();
  payload.backup_retention_days = Number(form?.backup_retention_days);
  return payload;
};

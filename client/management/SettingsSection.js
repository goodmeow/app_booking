import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import { useGetSettingsQuery, useRunBackupMutation, useUpdateSettingsMutation } from "../redux/services/settings.js";
import {
  settingsFormErrorKey,
  settingsFormFrom,
  settingsPayload,
  SETTINGS_NUMBER_FIELDS,
} from "./settings-form.js";
import BrandingSection from "./BrandingSection.js";

const NUMBER_FIELD_LABELS = {
  not_checked_in_time_limit: { label: "settings.checkInLimit", help: "settings.checkInLimitHelp" },
  time_of_event_start_soon: { label: "settings.startSoon", help: "settings.startSoonHelp" },
  lock_timer: { label: "settings.lockTimer", help: "settings.lockTimerHelp" },
  led_timer: { label: "settings.ledTimer", help: "settings.ledTimerHelp" },
};

// Global timers and kiosk switches. The server rejects a partial update, so the
// payload always carries the whole settings row.
const SettingsSection = () => {
  const { i18n, t } = useTranslation("management");
  const weekdayLabel = (day) => new Intl.DateTimeFormat(
    i18n.resolvedLanguage || i18n.language || "en",
    { weekday: "long" }
  ).format(new Date(2024, 0, 7 + day));
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();
  const [runBackup, { isLoading: backingUp }] = useRunBackupMutation();
  const [form, setForm] = useState(settingsFormFrom(null));
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (settings) setForm(settingsFormFrom(settings));
  }, [settings]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const backupNow = async () => {
    setFeedback(null);
    try {
      const result = await runBackup().unwrap();
      setFeedback({ severity: "success", message: t("settings.backupDone", { file: result.filename }) });
    } catch (error) {
      setFeedback({ severity: "error", message: getApiError(error, t("settings.backupError")) });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    const errorKey = settingsFormErrorKey(form);
    if (errorKey) {
      setFeedback({ severity: "error", message: t(errorKey) });
      return;
    }

    try {
      await updateSettings(settingsPayload(settings, form)).unwrap();
      setFeedback({ severity: "success", message: t("settings.saved") });
    } catch (error) {
      setFeedback({ severity: "error", message: getApiError(error, t("settings.saveError")) });
    }
  };

  if (isLoading) return <Typography>{t("settings.loading")}</Typography>;

  return (
    <Box component="form" id="settings-form" onSubmit={submit} sx={{ maxWidth: 760 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {t("settings.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.description")}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        {SETTINGS_NUMBER_FIELDS.map((field) => (
          <TextField
            key={field}
            type="number"
            size="small"
            label={t(NUMBER_FIELD_LABELS[field].label)}
            helperText={t(NUMBER_FIELD_LABELS[field].help)}
            value={form[field]}
            onChange={(event) => setField(field, event.target.value)}
            inputProps={{ min: 1, step: 1 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">{t("settings.minutesUnit")}</InputAdornment>,
            }}
            disabled={saving || !settings}
          />
        ))}
      </Box>

      <Box sx={{ mt: 2, maxWidth: 360 }}>
        <FormControl fullWidth size="small" disabled={saving || !settings}>
          <InputLabel id="week-start-label">{t("settings.weekStart")}</InputLabel>
          <Select
            labelId="week-start-label"
            label={t("settings.weekStart")}
            value={form.week_start_day}
            onChange={(event) => setField("week_start_day", event.target.value)}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <MenuItem key={day} value={String(day)}>{weekdayLabel(day)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {t("settings.weekStartHelp")}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t("settings.backupTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("settings.backupHelp")}
        </Typography>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <FormControlLabel
            control={(
              <Switch
                checked={form.backup_enabled}
                onChange={(event) => setField("backup_enabled", event.target.checked)}
                disabled={saving || !settings}
              />
            )}
            label={t("settings.backupEnabled")}
          />
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" }, gap: 2 }}>
          <TextField
            size="small"
            label={t("settings.backupPath")}
            helperText={t("settings.backupPathHelp")}
            value={form.backup_path}
            onChange={(event) => setField("backup_path", event.target.value)}
            disabled={saving || !settings}
          />
          <TextField
            size="small"
            label={t("settings.backupTime")}
            helperText={t("settings.backupTimeHelp")}
            value={form.backup_time}
            onChange={(event) => setField("backup_time", event.target.value)}
            disabled={saving || !settings}
          />
          <TextField
            size="small"
            type="number"
            label={t("settings.backupRetention")}
            value={form.backup_retention_days}
            onChange={(event) => setField("backup_retention_days", event.target.value)}
            inputProps={{ min: 1, max: 365, step: 1 }}
            disabled={saving || !settings}
          />
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mt: 2 }}>
          <Button type="button" variant="outlined" onClick={backupNow} disabled={saving || backingUp || !settings}>
            {backingUp ? t("settings.backupRunning") : t("settings.backupNow")}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {settings?.backup_last_at
              ? t("settings.backupLast", { status: settings.backup_last_status || "-", date: new Date(settings.backup_last_at).toLocaleString() })
              : t("settings.backupNever")}
          </Typography>
        </Stack>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Stack spacing={0.5}>
        <FormControlLabel
          control={(
            <Switch
              checked={form.table_input}
              onChange={(event) => setField("table_input", event.target.checked)}
              disabled={saving || !settings}
            />
          )}
          label={t("settings.tableInput")}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("settings.tableInputHelp")}
        </Typography>

        <FormControlLabel
          control={(
            <Switch
              checked={form.self_signup_enabled}
              onChange={(event) => setField("self_signup_enabled", event.target.checked)}
              disabled={saving || !settings}
            />
          )}
          label={t("settings.selfSignup")}
        />
        <Typography variant="body2" color="text.secondary">
          {t("settings.selfSignupHelp")}
        </Typography>
      </Stack>

      {feedback ? <Alert severity={feedback.severity} sx={{ mt: 2 }}>{feedback.message}</Alert> : null}

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" disabled={saving || !settings}>
          {t("settings.save")}
        </Button>
      </Stack>

      <Divider sx={{ my: 4 }} />
      <BrandingSection />
    </Box>
  );
};

export default SettingsSection;

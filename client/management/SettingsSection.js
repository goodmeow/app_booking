import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "../redux/services/settings.js";
import {
  settingsFormErrorKey,
  settingsFormFrom,
  settingsPayload,
  SETTINGS_NUMBER_FIELDS,
} from "./settings-form.js";

const NUMBER_FIELD_LABELS = {
  not_checked_in_time_limit: { label: "settings.checkInLimit", help: "settings.checkInLimitHelp" },
  time_of_event_start_soon: { label: "settings.startSoon", help: "settings.startSoonHelp" },
  lock_timer: { label: "settings.lockTimer", help: "settings.lockTimerHelp" },
  led_timer: { label: "settings.ledTimer", help: "settings.ledTimerHelp" },
};

// Global timers and kiosk switches. The server rejects a partial update, so the
// payload always carries the whole settings row.
const SettingsSection = () => {
  const { t } = useTranslation("management");
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();
  const [form, setForm] = useState(settingsFormFrom(null));
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (settings) setForm(settingsFormFrom(settings));
  }, [settings]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
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
    </Box>
  );
};

export default SettingsSection;

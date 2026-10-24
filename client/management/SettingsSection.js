import React, { useEffect, useState } from "react";
import { Alert, Box, FormControlLabel, Switch, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "../../redux/services/settings.js";

// Only the self-signup switch is exposed here. Other legacy timer fields are
// still stored but have no confirmed UI behaviour, so they stay untouched.
const SettingsSection = () => {
  const { t } = useTranslation("management");
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();
  const [signupEnabled, setSignupEnabled] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (settings) setSignupEnabled(settings.self_signup_enabled === true);
  }, [settings]);

  const toggleSignup = async (event) => {
    const nextValue = event.target.checked;
    setSignupEnabled(nextValue);
    setFeedback(null);
    try {
      await updateSettings({ ...settings, id: settings._id, self_signup_enabled: nextValue }).unwrap();
      setFeedback({ severity: "success", message: t("settings.saved") });
    } catch {
      setSignupEnabled(!nextValue);
      setFeedback({ severity: "error", message: t("settings.saveError") });
    }
  };

  if (isLoading) return <Typography>{t("settings.loading")}</Typography>;

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {t("settings.title")}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={signupEnabled}
            onChange={toggleSignup}
            disabled={saving || !settings}
          />
        }
        label={t("settings.selfSignup")}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.selfSignupHelp")}
      </Typography>
      {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}
    </Box>
  );
};

export default SettingsSection;

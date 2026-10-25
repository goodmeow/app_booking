import React, { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { authenticate, isAuthenticated, signout } from "./auth-helper.js";
import { useChangePasswordMutation } from "../redux/services/users.js";
import { brandAsset } from "../core/brand-assets.js";
import { useGetBrandingQuery } from "../redux/services/settings.js";

const MIN_PASSWORD_LENGTH = 8;

// Shown before any protected page when the account still uses the password set
// by the import or by an admin reset. The server also blocks other endpoints
// with 403 PASSWORD_CHANGE_REQUIRED, so this is not only a UI gate.
const ForcePasswordChange = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { data: branding } = useGetBrandingQuery();
  const session = isAuthenticated();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth:forcePassword.tooShort"));
      return;
    }
    if (next !== confirmation) {
      setError(t("auth:forcePassword.mismatch"));
      return;
    }
    if (next === current) {
      setError(t("auth:forcePassword.same"));
      return;
    }
    try {
      await changePassword({
        oldPassword: current,
        newPassword: next,
        newPasswordConfirmation: confirmation,
      }).unwrap();
      const persist = Boolean(window.localStorage?.getItem("jwt"));
      const updated = {
        ...session,
        user: { ...session.user, mustChangePassword: false },
      };
      authenticate(updated, () => window.location.assign("/"), persist);
    } catch (reason) {
      setError(reason?.data?.error || reason?.data?.message || t("auth:forcePassword.error"));
    }
  };

  const logout = () => signout(() => window.location.assign("/signin"));

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
      <Paper component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 460, p: { xs: 3, sm: 4 } }}>
        <Box component="img" src={brandAsset(branding, "mark")} alt={branding?.brand_name || t("common:brand.name")} sx={{ display: "block", height: 56, mx: "auto", mb: 2 }} />
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          {t("auth:forcePassword.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
          {t("auth:forcePassword.intro")}
        </Typography>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={2}>
          <TextField
            type="password"
            label={t("auth:forcePassword.current")}
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
            autoFocus
          />
          <TextField
            type="password"
            label={t("auth:forcePassword.new")}
            autoComplete="new-password"
            helperText={t("auth:forcePassword.rule")}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            required
          />
          <TextField
            type="password"
            label={t("auth:forcePassword.confirm")}
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
          <Button type="submit" variant="contained" size="large" disabled={isLoading}>
            {isLoading ? t("common:states.loading") : t("auth:forcePassword.submit")}
          </Button>
          <Button type="button" color="inherit" onClick={logout} disabled={isLoading}>
            {t("auth:forcePassword.logout")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ForcePasswordChange;

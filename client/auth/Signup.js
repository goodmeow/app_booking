import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link, Redirect } from "react-router-dom";
import { signup } from "./auth-helper.js";
import { brandAsset } from "../core/brand-assets.js";
import { useGetBrandingQuery, useGetPublicSettingsQuery } from "../redux/services/settings.js";

const Signup = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { data: publicSettings, isLoading: settingsLoading } = useGetPublicSettingsQuery();
  const { data: branding } = useGetBrandingQuery();
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await signup(form);
      setMessage(t("auth:signup.successMessage"));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  };

  const field = (name) => ({
    value: form[name],
    onChange: (event) => setForm({ ...form, [name]: event.target.value }),
  });

  // The admin switch hides the form and sends direct visitors back to sign in.
  // Wait for the flag first so an enabled form never flashes as disabled.
  if (settingsLoading) return null;
  if (!publicSettings?.self_signup_enabled) return <Redirect to="/signin" />;

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", p: 2 }}>
      <Paper component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 420, p: 4 }}>
        <Box component="img" src={brandAsset(branding, "mark")} alt={branding?.brand_name || t("common:brand.name")} sx={{ display: "block", height: 64, width: "auto", mx: "auto", mb: 1 }} />
        <Box component="img" src={brandAsset(branding, "wordmark")} alt="" sx={{ display: "block", height: 22, width: "auto", mx: "auto", mb: 2 }} />
        <Typography variant="h4" color="primary" align="center" gutterBottom>{branding?.brand_name || t("common:brand.name")}</Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>{t("common:brand.descriptor")}</Typography>
        <Typography variant="h6" gutterBottom>{t("auth:signup.title")}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField fullWidth required label={t("common:fields.name")} margin="normal" {...field("name")} />
        <TextField fullWidth required label={t("common:fields.email")} type="email" margin="normal" {...field("email")} />
        <TextField fullWidth label={t("common:fields.usernameOptional")} margin="normal" {...field("username")} />
        <TextField fullWidth required label={t("common:fields.password")} type="password" margin="normal" {...field("password")} />
        <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 2 }}>{loading ? t("common:states.loading") : t("common:actions.submit")}</Button>
        <Button component={Link} to="/signin" fullWidth sx={{ mt: 1 }}>{t("common:nav.signIn")}</Button>
      </Paper>
      <Dialog open={Boolean(message)} onClose={() => setMessage("")} aria-labelledby="signup-success-title">
        <DialogTitle id="signup-success-title">{t("auth:signup.successTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button component={Link} to="/signin" variant="contained">{t("common:nav.signIn")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Signup;

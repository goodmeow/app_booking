import React, { useState } from "react";
import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link, useHistory, useLocation } from "react-router-dom";
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { authenticate, signin } from "./auth-helper.js";

const Signin = () => {
  const { t } = useTranslation(["auth", "common"]);
  const history = useHistory();
  const location = useLocation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await signin({ email: login, password });
      setLoading(false);
      authenticate(data, () => {
        const destination = location.state?.from || "/";
        history.replace(typeof destination === "string" ? destination : {
          pathname: destination.pathname || "/",
          search: destination.search || "",
          hash: destination.hash || "",
        });
      });
    } catch (reason) {
      setError(reason.message);
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", p: 2 }}>
      <Paper component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 420, p: 4, bgcolor: "common.white" }}>
        <Box component="img" src="/icon.svg" alt={t("common:brand.name")} sx={{ display: "block", width: 80, height: 80, mx: "auto", mb: 2 }} />
        <Typography variant="h4" color="primary" align="center" gutterBottom>{t("common:brand.name")}</Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>{t("common:brand.descriptor")}</Typography>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <LanguageSwitcher />
        </Box>
        <Typography variant="h6" gutterBottom>{t("auth:signin.title")}</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField fullWidth required label={t("auth:signin.login")} type="text" margin="normal" value={login} onChange={(event) => setLogin(event.target.value)} />
        <TextField fullWidth required label={t("common:fields.password")} type="password" margin="normal" value={password} onChange={(event) => setPassword(event.target.value)} />
        <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 2 }}>{loading ? t("common:states.loading") : t("common:actions.submit")}</Button>
        <Button component={Link} to="/signup" fullWidth sx={{ mt: 1 }}>{t("auth:signin.createAccount")}</Button>
      </Paper>
    </Box>
  );
};

export default Signin;

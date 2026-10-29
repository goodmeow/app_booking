import React, { useState } from "react";
import { Alert, Button, Card, Input, Space, Typography } from "antd";
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
      const result = await changePassword({
        oldPassword: current,
        newPassword: next,
        newPasswordConfirmation: confirmation,
      }).unwrap();
      const persist = Boolean(window.localStorage?.getItem("jwt"));
      const updated = {
        ...session,
        ...(result.token ? { token: result.token } : {}),
        user: result.user || { ...session.user, mustChangePassword: false },
      };
      authenticate(updated, () => window.location.assign("/"), persist);
    } catch (reason) {
      setError(reason?.data?.error || reason?.data?.message || t("auth:forcePassword.error"));
    }
  };

  const logout = () => signout(() => window.location.assign("/signin"));

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <img
          src={brandAsset(branding, "mark")}
          alt={branding?.brand_name || t("common:brand.name")}
          style={{ display: "block", height: 56, margin: "0 auto 16px" }}
        />
        <Typography.Title level={4} style={{ textAlign: "center", marginTop: 0 }}>
          {t("auth:forcePassword.title")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: "center" }}>
          {t("auth:forcePassword.intro")}
        </Typography.Paragraph>

        <form onSubmit={submit}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {error ? <Alert type="error" showIcon message={error} /> : null}

            <div>
              <Typography.Text strong>{t("auth:forcePassword.current")}</Typography.Text>
              <Input.Password
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <Typography.Text strong>{t("auth:forcePassword.new")}</Typography.Text>
              <Input.Password
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
              />
              <Typography.Text type="secondary">{t("auth:forcePassword.rule")}</Typography.Text>
            </div>

            <div>
              <Typography.Text strong>{t("auth:forcePassword.confirm")}</Typography.Text>
              <Input.Password
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>

            <Button type="primary" htmlType="submit" size="large" block loading={isLoading}>
              {t("auth:forcePassword.submit")}
            </Button>
            <Button block onClick={logout} disabled={isLoading}>
              {t("auth:forcePassword.logout")}
            </Button>
          </Space>
        </form>
      </Card>
    </div>
  );
};

export default ForcePasswordChange;

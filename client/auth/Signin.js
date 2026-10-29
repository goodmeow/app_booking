import React, { useState } from "react";
import { Alert, Button, Checkbox, Input, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation, Link } from "react-router-dom";
import { authenticate, signin } from "./auth-helper.js";
import { useGetPublicSettingsQuery } from "../redux/services/settings.js";
import SigninBrandPanel from "./SigninBrandPanel.js";

const HELPDESK_EMAIL = "helpdesk@integrasolution.id";

const Signin = () => {
  const { t } = useTranslation(["auth", "common"]);
  const history = useHistory();
  const location = useLocation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    location.state?.setupComplete ? t("auth:setup.success") : ""
  );
  const [loading, setLoading] = useState(false);
  const { data: publicSettings } = useGetPublicSettingsQuery();
  const signupEnabled = publicSettings?.self_signup_enabled === true;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
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
      }, remember);
    } catch (reason) {
      const message = String(reason?.message || "");
      const networkFailure = /fetch|network|timeout/i.test(message);
      // Keep the server/CORS message visible; hiding it behind "wrong password"
      // sends users chasing credentials when the origin allowlist is the cause.
      setError(networkFailure ? t("common:states.error") : (message || t("auth:signin.errorInvalid")));
      setLoading(false);
    }
  };

  return (
    <div
      className="kiosk-auth"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexWrap: "wrap",
        background: "#11151B",
        color: "#F4F6F8",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <SigninBrandPanel />

      <main
        style={{
          flex: "1 1 480px",
          boxSizing: "border-box",
          padding: "56px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <Typography.Title
              level={1}
              style={{ margin: 0, fontSize: 44, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              {t("auth:signin.title")}
            </Typography.Title>
            <Typography.Paragraph style={{ margin: 0, fontSize: 20, lineHeight: 1.4, color: "#A9B3BF" }}>
              {t("auth:signin.subtitle")}
            </Typography.Paragraph>
          </div>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          {notice ? (
            <Alert
              type="warning"
              showIcon
              message={notice}
              description={notice === t("auth:signin.forgotNotice") ? (
                <a href={`mailto:${HELPDESK_EMAIL}`} style={{ color: "#FFD25A", fontWeight: 700 }}>
                  {HELPDESK_EMAIL}
                </a>
              ) : null}
            />
          ) : null}

          <form onSubmit={submit}>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <div>
                <Typography.Text strong style={{ fontSize: 18 }}>
                  {t("auth:signin.emailLabel")}
                </Typography.Text>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="email@example.com"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  required
                  size="large"
                />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    {t("common:fields.password")}
                  </Typography.Text>
                  <Button
                    type="link"
                    style={{ padding: 0, height: "auto" }}
                    onClick={() => setNotice(t("auth:signin.forgotNotice"))}
                  >
                    {t("auth:signin.forgot")}
                  </Button>
                </div>
                <Input.Password
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  size="large"
                />
              </div>

              <Checkbox checked={remember} onChange={(event) => setRemember(event.target.checked)}>
                {t("auth:signin.remember")}
              </Checkbox>

              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                {loading ? t("common:states.loading") : t("auth:signin.submit")}
              </Button>

              {signupEnabled ? (
                <div style={{ textAlign: "center" }}>
                  <Link to="/signup" style={{ color: "#FFD25A", fontWeight: 700 }}>
                    {t("auth:signin.createAccount")}
                  </Link>
                </div>
              ) : null}
            </Space>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Signin;

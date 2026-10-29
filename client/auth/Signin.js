import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Typography,
  theme,
} from "antd";
import { LockOutlined, MailOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation, Link } from "react-router-dom";
import { authenticate, signin } from "./auth-helper.js";
import { useGetPublicSettingsQuery } from "../redux/services/settings.js";
import { useGetBrandingQuery } from "../redux/services/settings.js";
import { brandAsset } from "../core/brand-assets.js";
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { useThemeMode } from "../theme-mode.js";

const HELPDESK_EMAIL = "helpdesk@integrasolution.id";

const Signin = () => {
  const { t } = useTranslation(["auth", "common"]);
  const history = useHistory();
  const location = useLocation();
  const { token } = theme.useToken();
  const { mode, toggle } = useThemeMode();
  const { data: branding } = useGetBrandingQuery();
  const { data: publicSettings } = useGetPublicSettingsQuery();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    location.state?.setupComplete ? t("auth:setup.success") : ""
  );
  const [loading, setLoading] = useState(false);
  const signupEnabled = publicSettings?.self_signup_enabled === true;

  const submit = async (values) => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const data = await signin({ email: values.email, password: values.password });
      setLoading(false);
      authenticate(data, () => {
        const destination = location.state?.from || "/";
        history.replace(typeof destination === "string" ? destination : {
          pathname: destination.pathname || "/",
          search: destination.search || "",
          hash: destination.hash || "",
        });
      }, values.remember);
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
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: token.colorBgLayout,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <LanguageSwitcher />
        <Button
          type="text"
          icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
          aria-label={t("common:nav.toggleTheme")}
          title={t("common:nav.toggleTheme")}
          onClick={toggle}
        />
      </div>

      <Card style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src={brandAsset(branding, "mark")}
            alt={branding?.brand_name || t("common:brand.name")}
            style={{ display: "block", height: 64, margin: "0 auto 12px" }}
          />
          <img
            src={brandAsset(branding, "wordmark")}
            alt=""
            style={{ display: "block", height: 22, margin: "0 auto" }}
          />
        </div>

        <Typography.Title level={2} style={{ textAlign: "center", marginTop: 0 }}>
          {t("auth:signin.title")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: "center" }}>
          {t("auth:signin.subtitle")}
        </Typography.Paragraph>

        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
        {notice ? (
          <Alert
            type="warning"
            showIcon
            message={notice}
            style={{ marginBottom: 16 }}
            description={notice === t("auth:signin.forgotNotice") ? (
              <a href={`mailto:${HELPDESK_EMAIL}`} style={{ color: token.colorWarning, fontWeight: 700 }}>
                {HELPDESK_EMAIL}
              </a>
            ) : null}
          />
        ) : null}

        <Form
          layout="vertical"
          initialValues={{ remember: false }}
          onFinish={submit}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={t("auth:signin.emailLabel")}
            rules={[
              { required: true, message: t("auth:signin.emailRequired") },
              { type: "email", message: t("auth:signin.emailInvalid") },
            ]}
          >
            <Input
              size="large"
              autoComplete="username"
              placeholder="email@example.com"
              prefix={<MailOutlined />}
            />
          </Form.Item>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Typography.Text strong>{t("common:fields.password")}</Typography.Text>
            <Button
              type="link"
              style={{ padding: 0, height: "auto" }}
              onClick={() => setNotice(t("auth:signin.forgotNotice"))}
            >
              {t("auth:signin.forgot")}
            </Button>
          </div>
          <Form.Item
            name="password"
            rules={[{ required: true, message: t("auth:signin.passwordRequired") }]}
            style={{ marginTop: 4 }}
          >
            <Input.Password
              size="large"
              autoComplete="current-password"
              prefix={<LockOutlined />}
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 16 }}>
            <Checkbox>{t("auth:signin.remember")}</Checkbox>
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            {loading ? t("common:states.loading") : t("auth:signin.submit")}
          </Button>
        </Form>

        {signupEnabled ? (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link to="/signup">{t("auth:signin.createAccount")}</Link>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default Signin;

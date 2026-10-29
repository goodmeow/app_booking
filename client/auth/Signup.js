import React, { useState } from "react";
import { Alert, Button, Card, Form, Input, Modal, Space, Typography } from "antd";
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
    <div style={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <img
          src={brandAsset(branding, "mark")}
          alt={branding?.brand_name || t("common:brand.name")}
          style={{ display: "block", height: 64, margin: "0 auto 8px" }}
        />
        <img
          src={brandAsset(branding, "wordmark")}
          alt=""
          style={{ display: "block", height: 22, margin: "0 auto 16px" }}
        />
        <Typography.Title level={4} style={{ textAlign: "center", marginTop: 0 }}>
          {branding?.brand_name || t("common:brand.name")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: "center" }}>
          {t("common:brand.descriptor")}
        </Typography.Paragraph>
        <Typography.Title level={5}>{t("auth:signup.title")}</Typography.Title>

        <form onSubmit={submit}>
          <Form component={false} layout="vertical">
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {error ? <Alert type="error" showIcon message={error} /> : null}

              <Form.Item label={t("common:fields.name")} required style={{ marginBottom: 0 }}>
                <Input {...field("name")} />
              </Form.Item>
              <Form.Item label={t("common:fields.email")} required style={{ marginBottom: 0 }}>
                <Input type="email" {...field("email")} />
              </Form.Item>
              <Form.Item label={t("common:fields.usernameOptional")} style={{ marginBottom: 0 }}>
                <Input {...field("username")} />
              </Form.Item>
              <Form.Item label={t("common:fields.password")} required style={{ marginBottom: 0 }}>
                <Input.Password {...field("password")} />
              </Form.Item>

              <Button type="primary" htmlType="submit" block loading={loading}>
                {loading ? t("common:states.loading") : t("common:actions.submit")}
              </Button>
              <Link to="/signin">
                <Button block>{t("common:nav.signIn")}</Button>
              </Link>
            </Space>
          </Form>
        </form>
      </Card>

      <Modal
        open={Boolean(message)}
        title={t("auth:signup.successTitle")}
        onCancel={() => setMessage("")}
        footer={(
          <Link to="/signin">
            <Button type="primary">{t("common:nav.signIn")}</Button>
          </Link>
        )}
      >
        <p style={{ margin: 0 }}>{message}</p>
      </Modal>
    </div>
  );
};

export default Signup;

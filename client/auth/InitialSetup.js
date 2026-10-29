import React, { useState } from "react";
import { Alert, Button, Form, Input, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import SigninBrandPanel from "./SigninBrandPanel.js";
import { authenticate, signin } from "./auth-helper.js";
import { getApiError } from "../domain/api-error.js";
import { buildSetupPayload, validateSetupForm } from "../domain/setup.js";
import { useSubmitSetupMutation } from "../redux/services/setup.js";

const SetupField = ({
  id,
  label,
  help,
  type = "text",
  autoComplete,
  value,
  onChange,
  required = true,
  autoFocus = false,
}) => (
  <Form.Item
    label={label}
    help={help}
    required={required}
    style={{ marginBottom: 0 }}
  >
    {type === "password" ? (
      <Input.Password
        id={id}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
        autoFocus={autoFocus}
      />
    ) : (
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
        autoFocus={autoFocus}
      />
    )}
  </Form.Item>
);

const InitialSetup = () => {
  const { t } = useTranslation(["auth", "common"]);
  const [form, setForm] = useState({ name: "", email: "", employeeId: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [submitSetup, { isLoading }] = useSubmitSetupMutation();

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const validationError = validateSetupForm(form);
    if (validationError) {
      setError(t(`auth:setup.errors.${validationError}`));
      return;
    }
    try {
      await submitSetup(buildSetupPayload(form)).unwrap();
      // Sign in with the password just chosen and reload the app. A hard
      // navigation drops the stale setup-status cache instead of racing the
      // gate between /setup and /signin, and the operator lands on the
      // calendar without retyping the credentials.
      try {
        const session = await signin({ email: form.email.trim(), password: form.password });
        authenticate(session, () => window.location.assign("/"), false);
      } catch {
        window.location.assign("/signin");
      }
    } catch (reason) {
      setError(getApiError(reason, t("auth:setup.errors.generic")));
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
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <Typography.Title
              level={1}
              style={{ margin: 0, fontSize: 38, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              {t("auth:setup.title")}
            </Typography.Title>
            <Typography.Paragraph style={{ margin: 0, fontSize: 18, lineHeight: 1.5, color: "#A9B3BF" }}>
              {t("auth:setup.intro")}
            </Typography.Paragraph>
          </div>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <form onSubmit={submit}>
            <Form component={false} layout="vertical">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <SetupField
                  id="setup-name"
                  label={t("auth:setup.name")}
                  autoComplete="name"
                  value={form.name}
                  onChange={updateField("name")}
                  autoFocus
                />
                <SetupField
                  id="setup-email"
                  label={t("auth:setup.email")}
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={updateField("email")}
                />
                <SetupField
                  id="setup-employee-id"
                  label={t("auth:setup.employeeId")}
                  help={t("auth:setup.employeeIdHelp")}
                  autoComplete="off"
                  value={form.employeeId}
                  onChange={updateField("employeeId")}
                  required={false}
                />
                <SetupField
                  id="setup-password"
                  label={t("auth:setup.password")}
                  help={t("auth:setup.passwordRule")}
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={updateField("password")}
                />
                <SetupField
                  id="setup-confirm"
                  label={t("auth:setup.confirm")}
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={updateField("confirm")}
                />

                <Button type="primary" htmlType="submit" size="large" block loading={isLoading}>
                  {isLoading ? t("auth:setup.loading") : t("auth:setup.submit")}
                </Button>
              </Space>
            </Form>
          </form>
        </div>
      </main>
    </div>
  );
};

export default InitialSetup;

import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Typography,
  theme,
} from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { authenticate, signin } from "./auth-helper.js";
import { getApiError } from "../domain/api-error.js";
import { buildSetupPayload, validateSetupForm } from "../domain/setup.js";
import { useSubmitSetupMutation } from "../redux/services/setup.js";
import { useGetBrandingQuery } from "../redux/services/settings.js";
import { brandAsset } from "../core/brand-assets.js";
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { useThemeMode } from "../theme-mode.js";

const InitialSetup = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { token } = theme.useToken();
  const { mode, toggle } = useThemeMode();
  const { data: branding } = useGetBrandingQuery();
  const [error, setError] = useState("");
  const [submitSetup, { isLoading }] = useSubmitSetupMutation();

  const submit = async (values) => {
    setError("");
    const form = {
      name: values.name.trim(),
      email: values.email.trim(),
      employeeId: values.employeeId?.trim() || "",
      password: values.password,
      confirm: values.confirm,
    };
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
        const session = await signin({ email: form.email, password: form.password });
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
      style={{
        minHeight: "100vh",
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
          maxWidth: 480,
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

      <Card style={{ width: "100%", maxWidth: 480 }}>
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
          {t("auth:setup.title")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: "center" }}>
          {t("auth:setup.intro")}
        </Typography.Paragraph>

        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}

        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            name="name"
            label={t("auth:setup.name")}
            rules={[{ required: true, message: t("auth:setup.errors.nameRequired") }]}
          >
            <Input autoComplete="name" autoFocus />
          </Form.Item>
          <Form.Item
            name="email"
            label={t("auth:setup.email")}
            rules={[{ required: true, message: t("auth:setup.errors.emailRequired") }]}
          >
            <Input type="email" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="employeeId"
            label={t("auth:setup.employeeId")}
            extra={t("auth:setup.employeeIdHelp")}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t("auth:setup.password")}
            extra={t("auth:setup.passwordRule")}
            rules={[{ required: true, message: t("auth:setup.errors.passwordTooShort") }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={t("auth:setup.confirm")}
            rules={[{ required: true, message: t("auth:setup.errors.passwordMismatch") }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={isLoading}>
            {isLoading ? t("auth:setup.loading") : t("auth:setup.submit")}
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default InitialSetup;

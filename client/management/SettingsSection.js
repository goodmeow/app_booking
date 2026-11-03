import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Switch, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import { useGetSettingsQuery, useRunBackupMutation, useUpdateSettingsMutation } from "../redux/services/settings.js";
import {
  settingsFormErrorKey,
  settingsFormFrom,
  settingsPayload,
  SETTINGS_NUMBER_FIELDS,
} from "./settings-form.js";
import BrandingSection from "./BrandingSection.js";
import RoleAccessMatrix from "./RoleAccessMatrix.js";
import AuditLogSection from "./AuditLogSection.js";
import { useMenuAccess } from "../auth/use-menu-access.js";

const NUMBER_FIELD_LABELS = {
  not_checked_in_time_limit: { label: "settings.checkInLimit", help: "settings.checkInLimitHelp" },
  time_of_event_start_soon: { label: "settings.startSoon", help: "settings.startSoonHelp" },
  lock_timer: { label: "settings.lockTimer", help: "settings.lockTimerHelp" },
  led_timer: { label: "settings.ledTimer", help: "settings.ledTimerHelp" },
};

// Global timers and kiosk switches. The server rejects a partial update, so the
// payload always carries the whole settings row.
const SettingsSection = () => {
  const { i18n, t } = useTranslation("management");
  const { isSuperAdmin } = useMenuAccess();
  const weekdayLabel = (day) => new Intl.DateTimeFormat(
    i18n.resolvedLanguage || i18n.language || "en",
    { weekday: "long" }
  ).format(new Date(2024, 0, 7 + day));
  const { data: settings, isLoading } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();
  const [runBackup, { isLoading: backingUp }] = useRunBackupMutation();
  const [form, setForm] = useState(settingsFormFrom(null));
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (settings) setForm(settingsFormFrom(settings));
  }, [settings]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const backupNow = async () => {
    setFeedback(null);
    try {
      const result = await runBackup().unwrap();
      setFeedback({ severity: "success", message: t("settings.backupDone", { file: result.filename }) });
    } catch (error) {
      setFeedback({ severity: "error", message: getApiError(error, t("settings.backupError")) });
    }
  };

  const submit = async () => {
    setFeedback(null);
    const errorKey = settingsFormErrorKey(form);
    if (errorKey) {
      setFeedback({ severity: "error", message: t(errorKey) });
      return;
    }

    try {
      await updateSettings(settingsPayload(settings, form)).unwrap();
      setFeedback({ severity: "success", message: t("settings.saved") });
    } catch (error) {
      setFeedback({ severity: "error", message: getApiError(error, t("settings.saveError")) });
    }
  };

  if (isLoading) return <Typography.Text>{t("settings.loading")}</Typography.Text>;

  return (
    <div style={{ maxWidth: 900 }}>
      <Space
        align="start"
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>{t("settings.title")}</Typography.Title>
          <Typography.Text type="secondary">{t("settings.description")}</Typography.Text>
        </div>
        <Button
          type="primary"
          htmlType="submit"
          form="settings-form"
          disabled={saving || !settings}
          loading={saving}
        >
          {t("settings.save")}
        </Button>
      </Space>

      {feedback ? (
        <Alert type={feedback.severity} showIcon message={feedback.message} style={{ marginBottom: 16 }} />
      ) : null}

      <form
        id="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Form component={false} layout="vertical">
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card size="small" title={t("settings.generalTitle")}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                {SETTINGS_NUMBER_FIELDS.map((field) => (
                  <Form.Item
                    key={field}
                    label={t(NUMBER_FIELD_LABELS[field].label)}
                    help={t(NUMBER_FIELD_LABELS[field].help)}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={1}
                      step={1}
                      value={Number(form[field])}
                      onChange={(value) => setField(field, value ?? "")}
                      addonAfter={t("settings.minutesUnit")}
                      disabled={saving || !settings}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                ))}
              </div>

              <Form.Item
                label={t("settings.weekStart")}
                help={t("settings.weekStartHelp")}
                style={{ marginTop: 16, marginBottom: 0, maxWidth: 360 }}
              >
                <Select
                  value={form.week_start_day}
                  onChange={(value) => setField("week_start_day", value)}
                  disabled={saving || !settings}
                  options={[0, 1, 2, 3, 4, 5, 6].map((day) => ({
                    value: String(day),
                    label: weekdayLabel(day),
                  }))}
                />
              </Form.Item>
            </Card>

            <Card
              size="small"
              title={t("settings.backupTitle")}
              extra={(
                <Button
                  htmlType="button"
                  onClick={backupNow}
                  disabled={saving || backingUp || !settings}
                  loading={backingUp}
                >
                  {backingUp ? t("settings.backupRunning") : t("settings.backupNow")}
                </Button>
              )}
            >
              <Typography.Paragraph type="secondary">{t("settings.backupHelp")}</Typography.Paragraph>

              <Form.Item label={t("settings.backupEnabled")} style={{ marginBottom: 16 }}>
                <Switch
                  checked={form.backup_enabled}
                  onChange={(checked) => setField("backup_enabled", checked)}
                  disabled={saving || !settings}
                />
              </Form.Item>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
                <Form.Item
                  label={t("settings.backupPath")}
                  help={t("settings.backupPathHelp")}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    value={form.backup_path}
                    onChange={(event) => setField("backup_path", event.target.value)}
                    disabled={saving || !settings}
                  />
                </Form.Item>
                <Form.Item
                  label={t("settings.backupTime")}
                  help={t("settings.backupTimeHelp")}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    value={form.backup_time}
                    onChange={(event) => setField("backup_time", event.target.value)}
                    disabled={saving || !settings}
                  />
                </Form.Item>
                <Form.Item label={t("settings.backupRetention")} style={{ marginBottom: 0 }}>
                  <InputNumber
                    min={1}
                    max={365}
                    step={1}
                    value={Number(form.backup_retention_days)}
                    onChange={(value) => setField("backup_retention_days", value ?? "")}
                    disabled={saving || !settings}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </div>

              <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                {settings?.backup_last_at
                  ? t("settings.backupLast", { status: settings.backup_last_status || "-", date: new Date(settings.backup_last_at).toLocaleString() })
                  : t("settings.backupNever")}
              </Typography.Text>
            </Card>

            <Card size="small" title={t("settings.kioskTitle")}>
              <Form.Item
                label={t("settings.tableInput")}
                extra={t("settings.tableInputHelp")}
                style={{ marginBottom: 16 }}
              >
                <Switch
                  checked={form.table_input}
                  onChange={(checked) => setField("table_input", checked)}
                  disabled={saving || !settings}
                />
              </Form.Item>
              <Form.Item
                label={t("settings.selfSignup")}
                extra={t("settings.selfSignupHelp")}
                style={{ marginBottom: 0 }}
              >
                <Switch
                  checked={form.self_signup_enabled}
                  onChange={(checked) => setField("self_signup_enabled", checked)}
                  disabled={saving || !settings}
                />
              </Form.Item>
            </Card>

            <Card size="small" title={t("branding.title")}>
              <BrandingSection />
            </Card>

            {isSuperAdmin ? (
              <>
                <Card size="small" title={t("settings.roleAccess.title")}>
                  <RoleAccessMatrix />
                </Card>
                <Card size="small" title={t("settings.audit.title")}>
                  <AuditLogSection />
                </Card>
              </>
            ) : null}
          </Space>
        </Form>
      </form>
    </div>
  );
};

export default SettingsSection;

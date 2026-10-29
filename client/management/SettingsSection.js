import React, { useEffect, useState } from "react";
import { Alert, Button, Divider, Input, InputNumber, Select, Space, Switch, Typography } from "antd";
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

  const submit = async (event) => {
    event.preventDefault();
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
    <form id="settings-form" onSubmit={submit} style={{ maxWidth: 760 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>{t("settings.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">{t("settings.description")}</Typography.Paragraph>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {SETTINGS_NUMBER_FIELDS.map((field) => (
          <div key={field}>
            <Typography.Text strong>{t(NUMBER_FIELD_LABELS[field].label)}</Typography.Text>
            <InputNumber
              min={1}
              step={1}
              value={Number(form[field])}
              onChange={(value) => setField(field, value ?? "")}
              addonAfter={t("settings.minutesUnit")}
              disabled={saving || !settings}
              style={{ width: "100%" }}
            />
            <Typography.Text type="secondary">{t(NUMBER_FIELD_LABELS[field].help)}</Typography.Text>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, maxWidth: 360 }}>
        <Typography.Text strong>{t("settings.weekStart")}</Typography.Text>
        <Select
          value={form.week_start_day}
          onChange={(value) => setField("week_start_day", value)}
          disabled={saving || !settings}
          style={{ width: "100%" }}
          options={[0, 1, 2, 3, 4, 5, 6].map((day) => ({
            value: String(day),
            label: weekdayLabel(day),
          }))}
        />
        <Typography.Text type="secondary">{t("settings.weekStartHelp")}</Typography.Text>
      </div>

      <Divider style={{ margin: "24px 0" }} />

      <div>
        <Typography.Title level={5} style={{ marginTop: 0 }}>{t("settings.backupTitle")}</Typography.Title>
        <Typography.Paragraph type="secondary">{t("settings.backupHelp")}</Typography.Paragraph>

        <Space style={{ marginBottom: 12 }}>
          <Switch
            checked={form.backup_enabled}
            onChange={(checked) => setField("backup_enabled", checked)}
            disabled={saving || !settings}
          />
          <Typography.Text>{t("settings.backupEnabled")}</Typography.Text>
        </Space>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
          <div>
            <Typography.Text strong>{t("settings.backupPath")}</Typography.Text>
            <Input
              value={form.backup_path}
              onChange={(event) => setField("backup_path", event.target.value)}
              disabled={saving || !settings}
            />
            <Typography.Text type="secondary">{t("settings.backupPathHelp")}</Typography.Text>
          </div>
          <div>
            <Typography.Text strong>{t("settings.backupTime")}</Typography.Text>
            <Input
              value={form.backup_time}
              onChange={(event) => setField("backup_time", event.target.value)}
              disabled={saving || !settings}
            />
            <Typography.Text type="secondary">{t("settings.backupTimeHelp")}</Typography.Text>
          </div>
          <div>
            <Typography.Text strong>{t("settings.backupRetention")}</Typography.Text>
            <InputNumber
              min={1}
              max={365}
              step={1}
              value={Number(form.backup_retention_days)}
              onChange={(value) => setField("backup_retention_days", value ?? "")}
              disabled={saving || !settings}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <Space style={{ marginTop: 16 }} wrap>
          <Button onClick={backupNow} disabled={saving || backingUp || !settings} loading={backingUp}>
            {backingUp ? t("settings.backupRunning") : t("settings.backupNow")}
          </Button>
          <Typography.Text type="secondary">
            {settings?.backup_last_at
              ? t("settings.backupLast", { status: settings.backup_last_status || "-", date: new Date(settings.backup_last_at).toLocaleString() })
              : t("settings.backupNever")}
          </Typography.Text>
        </Space>
      </div>

      <Divider style={{ margin: "24px 0" }} />

      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Space>
          <Switch
            checked={form.table_input}
            onChange={(checked) => setField("table_input", checked)}
            disabled={saving || !settings}
          />
          <Typography.Text>{t("settings.tableInput")}</Typography.Text>
        </Space>
        <Typography.Text type="secondary">{t("settings.tableInputHelp")}</Typography.Text>

        <Space>
          <Switch
            checked={form.self_signup_enabled}
            onChange={(checked) => setField("self_signup_enabled", checked)}
            disabled={saving || !settings}
          />
          <Typography.Text>{t("settings.selfSignup")}</Typography.Text>
        </Space>
        <Typography.Text type="secondary">{t("settings.selfSignupHelp")}</Typography.Text>
      </Space>

      {feedback ? (
        <Alert type={feedback.severity} showIcon message={feedback.message} style={{ marginTop: 16 }} />
      ) : null}

      <Space style={{ width: "100%", justifyContent: "flex-end", marginTop: 16 }}>
        <Button type="primary" htmlType="submit" disabled={saving || !settings}>
          {t("settings.save")}
        </Button>
      </Space>

      <Divider style={{ margin: "32px 0" }} />
      <BrandingSection />

      {isSuperAdmin ? (
        <>
          <Divider style={{ margin: "32px 0" }} />
          <RoleAccessMatrix />
          <Divider style={{ margin: "32px 0" }} />
          <AuditLogSection />
        </>
      ) : null}
    </form>
  );
};

export default SettingsSection;

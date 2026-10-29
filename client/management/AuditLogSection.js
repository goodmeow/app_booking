import React from "react";
import { Alert, Button, Table, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import { useGetAuditLogQuery } from "../redux/services/audit.js";

const summary = (row) => {
  const values = row.new_values || row.old_values;
  if (!values) return "-";
  const entries = Array.isArray(values) ? values : [values];
  return entries.map((entry) => (
    typeof entry === "object" && entry !== null
      ? Object.entries(entry).map(([key, value]) => `${key}: ${value}`).join(" ")
      : String(entry)
  )).join("; ");
};

const AuditLogSection = () => {
  const { t, i18n } = useTranslation("management");
  const { data, isLoading, isError, error, refetch } = useGetAuditLogQuery(100);

  if (isLoading) return <Typography.Text>{t("settings.audit.loading")}</Typography.Text>;
  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={getApiError(error, t("settings.audit.loadError"))}
        action={<Button size="small" onClick={refetch}>{t("common:actions.retry")}</Button>}
      />
    );
  }

  const columns = [
    {
      title: t("settings.audit.time"),
      dataIndex: "created_at",
      key: "created_at",
      width: 190,
      render: (value) => new Date(value).toLocaleString(i18n.resolvedLanguage || i18n.language),
    },
    {
      title: t("settings.audit.actor"),
      dataIndex: "actor_name",
      key: "actor_name",
      width: 180,
      render: (value) => value || "-",
    },
    {
      title: t("settings.audit.action"),
      dataIndex: "action",
      key: "action",
      width: 160,
      render: (value) => (
        <Tag color="green">{t(`settings.audit.actions.${value}`, { defaultValue: value })}</Tag>
      ),
    },
    {
      title: t("settings.audit.details"),
      key: "details",
      render: (_, row) => (
        <Typography.Text style={{ wordBreak: "break-word" }}>{summary(row)}</Typography.Text>
      ),
    },
  ];

  return (
    <section>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t("settings.audit.title")}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t("settings.audit.description")}</Typography.Paragraph>
      {data?.length ? (
        <Table
          size="small"
          rowKey="_id"
          columns={columns}
          dataSource={data}
          pagination={false}
          scroll={{ x: 900, y: 420 }}
        />
      ) : (
        <Alert type="info" showIcon message={t("settings.audit.empty")} />
      )}
    </section>
  );
};

export default AuditLogSection;

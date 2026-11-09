import React, { useState } from "react";
import { Alert, Badge, Button, Select, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { localeForLanguage } from "../i18n/languages.js";
import { useGetFaceStatusQuery, useGetFaceTemplatesQuery, useGetFaceVerifyLogQuery } from "../redux/services/face.js";

const PAGE_SIZE = 100;

const formatDateTime = (value, language) =>
  value
    ? new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "-";

const resultTag = (result, t) => {
  const colors = { match: "green", no_match: "red", error: "red" };
  return <Tag color={colors[result]}>{t(`face.results.${result}`)}</Tag>;
};

const FaceSection = () => {
  const { t, i18n } = useTranslation(["management", "common"]);
  const {
    data: status,
    isLoading: isStatusLoading,
    isFetching: isStatusFetching,
    refetch: refetchStatus,
  } = useGetFaceStatusQuery(undefined, { pollingInterval: 60000 });
  const available = status?.available === true;
  const [resultFilter, setResultFilter] = useState("all");
  const {
    data: templates,
    isFetching: isTemplatesFetching,
    refetch: refetchTemplates,
  } = useGetFaceTemplatesQuery({ limit: PAGE_SIZE, offset: 0 }, { skip: !available });
  const {
    data: verifyLog,
    error: verifyLogError,
    isFetching: isVerifyLogFetching,
    refetch: refetchVerifyLog,
  } = useGetFaceVerifyLogQuery(
    { limit: PAGE_SIZE, offset: 0, result: resultFilter === "all" ? undefined : resultFilter },
    { skip: !available },
  );

  const language = i18n.resolvedLanguage || "en";

  const templateColumns = [
    { title: t("face.columns.name"), dataIndex: "name", key: "name", render: (value) => value || "—" },
    { title: t("face.columns.employeeId"), dataIndex: "employee_id", key: "employee_id" },
    { title: t("face.columns.group"), dataIndex: "face_group", key: "face_group" },
    { title: t("face.columns.model"), dataIndex: "model_version", key: "model_version" },
    {
      title: t("face.columns.quality"),
      dataIndex: "quality",
      key: "quality",
      render: (value) => (typeof value === "number" ? value.toFixed(2) : "—"),
    },
    {
      title: t("face.columns.registered"),
      dataIndex: "created_at",
      key: "created_at",
      render: (value) => formatDateTime(value, language),
    },
  ];

  const verifyLogColumns = [
    {
      title: t("face.columns.time"),
      dataIndex: "created_at",
      key: "created_at",
      render: (value) => formatDateTime(value, language),
    },
    {
      title: t("face.columns.name"),
      key: "name",
      render: (_, row) => row.name || row.employee_id || "—",
    },
    {
      title: t("face.columns.result"),
      dataIndex: "result",
      key: "result",
      render: (value) => resultTag(value, t),
    },
    {
      title: t("face.columns.score"),
      dataIndex: "score",
      key: "score",
      render: (value) => (typeof value === "number" ? value.toFixed(3) : "—"),
    },
    {
      title: t("face.columns.margin"),
      dataIndex: "margin",
      key: "margin",
      render: (value) => (typeof value === "number" ? value.toFixed(3) : "—"),
    },
    { title: t("face.columns.device"), dataIndex: "device_id", key: "device_id", render: (value) => value || "—" },
  ];

  const refresh = () => {
    void refetchStatus();
    void refetchTemplates();
    void refetchVerifyLog();
  };

  return (
    <section>
      <Space
        align="center"
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t("face.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("face.description")}</Typography.Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={refresh}
          loading={isStatusFetching || isTemplatesFetching || isVerifyLogFetching}
        >
          {t("face.actions.refresh")}
        </Button>
      </Space>

      {isStatusLoading ? <LoadingState label={t("common:states.loading")} /> : null}

      {!isStatusLoading && !available ? (
        <Alert
          type="warning"
          showIcon
          message={t("face.status.disconnected")}
          description={t("face.status.description")}
        />
      ) : null}

      {available ? (
        <>
          <Space size={16} wrap style={{ marginBottom: 16 }}>
            <Badge status="success" text={t("face.status.connected")} />
            <Typography.Text type="secondary">
              {t("face.status.version", { version: status.model_version || "—" })}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t("face.status.templates", { count: templates?.total ?? status.templates ?? 0 })}
            </Typography.Text>
          </Space>

          <Typography.Title level={5}>{t("face.templatesTitle")}</Typography.Title>
          <Table
            size="small"
            rowKey="employee_id"
            columns={templateColumns}
            dataSource={templates?.templates || []}
            loading={isTemplatesFetching}
            pagination={false}
            locale={{ emptyText: t("face.empty.noData") }}
            style={{ marginBottom: 24 }}
          />

          <Space align="center" style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t("face.verifyLogTitle")}
            </Typography.Title>
            <Select
              value={resultFilter}
              onChange={setResultFilter}
              style={{ minWidth: 160 }}
              aria-label={t("face.filters.result")}
              options={[
                { value: "all", label: t("face.filters.all") },
                { value: "match", label: t("face.results.match") },
                { value: "no_match", label: t("face.results.no_match") },
                { value: "no_face", label: t("face.results.no_face") },
                { value: "error", label: t("face.results.error") },
              ]}
            />
          </Space>
          {verifyLogError ? (
            <Alert
              type="error"
              showIcon
              message={getApiError(verifyLogError, t("face.loadError"))}
              style={{ margin: "12px 0" }}
            />
          ) : null}
          <Table
            size="small"
            rowKey={(row) => `${row.created_at}-${row.employee_id}-${row.result}`}
            columns={verifyLogColumns}
            dataSource={verifyLog?.entries || []}
            loading={isVerifyLogFetching}
            pagination={false}
            locale={{ emptyText: t("face.empty.noData") }}
          />
        </>
      ) : null}
    </section>
  );
};

export default FaceSection;

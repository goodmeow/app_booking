import React, { useState } from "react";
import { Alert, Button, Space, Switch, Table, Tag, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { localeForLanguage } from "../i18n/languages.js";
import {
  useGetKioskDevicesQuery,
  useRevokeKioskDeviceMutation,
  useUpdateKioskDeviceCapabilitiesMutation,
} from "../redux/services/kiosk-devices.js";

const formatDateTime = (value, language, neverLabel) => value
  ? new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : neverLabel;

const KioskDeviceManagementSection = () => {
  const { t, i18n } = useTranslation(["management", "common"]);
  const { data: devices = [], error: queryError, isLoading, isFetching, refetch } = useGetKioskDevicesQuery(undefined, { pollingInterval: 15000 });
  const [revokeDevice, { isLoading: isRevoking }] = useRevokeKioskDeviceMutation();
  const [updateCapabilities, { isLoading: isUpdatingCapabilities }] = useUpdateKioskDeviceCapabilitiesMutation();
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeError, setRevokeError] = useState("");
  const [capabilityError, setCapabilityError] = useState("");

  const toggleCapability = async (deviceId, capability, enabled) => {
    setCapabilityError("");
    try {
      await updateCapabilities({ deviceId, [capability]: enabled }).unwrap();
    } catch (error) {
      setCapabilityError(getApiError(error, t("devices.capabilityError")));
    }
  };

  const openRevokeDialog = (row) => {
    setRevokeError("");
    setRevokeTarget(row);
  };

  const closeRevoke = () => {
    if (isRevoking) return;
    setRevokeTarget(null);
    setRevokeError("");
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevokeError("");
    try {
      await revokeDevice(revokeTarget.id).unwrap();
      setRevokeTarget(null);
    } catch (error) {
      setRevokeError(getApiError(error, t("devices.revokeError")));
    }
  };

  const statusTag = (row) => {
    if (row.status === "revoked") return <Tag color="red">{t("devices.status.revoked")}</Tag>;
    if (row.status === "expired") return <Tag color="gold">{t("devices.status.expired")}</Tag>;
    return row.online
      ? <Tag color="green">{t("devices.status.online")}</Tag>
      : <Tag>{t("devices.status.offline")}</Tag>;
  };

  const columns = [
    {
      title: t("devices.device"),
      dataIndex: "name",
      key: "name",
      width: 200,
    },
    {
      title: t("devices.room"),
      key: "roomName",
      width: 240,
      render: (_, row) => row.roomName || row.roomEmail || t("devices.unknownRoom"),
    },
    {
      title: t("common:fields.status"),
      key: "status",
      width: 120,
      render: (_, row) => statusTag(row),
    },
    {
      title: "LED",
      key: "ledEnabled",
      width: 90,
      render: (_, row) => (
        <Switch
          size="small"
          checked={Boolean(row.ledEnabled)}
          disabled={row.status !== "active" || isUpdatingCapabilities}
          aria-label={t("devices.ledAria", { name: row.name })}
          onChange={(checked) => void toggleCapability(row.id, "ledEnabled", checked)}
        />
      ),
    },
    {
      title: t("devices.subjectColumn"),
      key: "showSubject",
      width: 110,
      render: (_, row) => (
        <Switch
          size="small"
          checked={Boolean(row.showSubject)}
          disabled={row.status !== "active" || isUpdatingCapabilities}
          aria-label={t("devices.subjectAria", { name: row.name })}
          onChange={(checked) => void toggleCapability(row.id, "showSubject", checked)}
        />
      ),
    },
    {
      title: t("devices.lastSeen"),
      dataIndex: "lastSeenAt",
      key: "lastSeenAt",
      width: 200,
      render: (value) => formatDateTime(value, i18n.resolvedLanguage || "en", t("common:states.never")),
    },
    {
      title: t("devices.provisioned"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 200,
      render: (value) => formatDateTime(value, i18n.resolvedLanguage || "en", t("common:states.never")),
    },
    {
      title: t("common:fields.action"),
      key: "actions",
      width: 120,
      render: (_, row) => row.status === "active" ? (
        <Button
          danger
          size="small"
          onClick={() => openRevokeDialog(row)}
          aria-label={t("devices.revokeAria", { name: row.name })}
        >
          {t("devices.revoke")}
        </Button>
      ) : null,
    },
  ];

  return (
    <section>
      <Space
        align="center"
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>{t("devices.title")}</Typography.Title>
          <Typography.Text type="secondary">{t("devices.description")}</Typography.Text>
        </div>
        {/* Plain download: the static file /apk/kiosk-release.apk shipped by Vite. */}
        <Button
          href="/apk/kiosk-release.apk"
          download="kiosk-release.apk"
          icon={<DownloadOutlined />}
          aria-label={t("devices.downloadApkAria")}
          title={t("devices.downloadApkHint")}
        >
          {t("devices.downloadApk")}
        </Button>
      </Space>

      {isFetching && !isLoading ? (
        <Alert type="info" showIcon message={t("common:states.refreshing")} style={{ marginBottom: 8 }} />
      ) : null}
      {isLoading && <LoadingState label={t("devices.loading")} />}
      {queryError && !isLoading ? (
        <ErrorState message={getApiError(queryError, t("devices.loadError"))} busy={isFetching} onAction={refetch} />
      ) : null}
      {capabilityError ? (
        <Alert type="error" showIcon message={capabilityError} style={{ marginBottom: 16 }} />
      ) : null}
      {!isLoading && (!queryError || devices.length > 0) ? (
        <Table
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={devices}
          loading={isFetching}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          scroll={{ x: 1200 }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t("devices.revokeTitle")}
        message={revokeError || t("devices.revokeMessage", { name: revokeTarget?.name || t("devices.device") })}
        loading={isRevoking}
        onCancel={closeRevoke}
        onConfirm={confirmRevoke}
      />
    </section>
  );
};

export default KioskDeviceManagementSection;

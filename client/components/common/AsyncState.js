import React from "react";
import { Alert, Button, Empty, Spin, Typography } from "antd";
import { useTranslation } from "react-i18next";

export const LoadingState = ({ label }) => {
  const { t } = useTranslation("common");

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "32px 0",
      }}
    >
      <Spin size="small" />
      <Typography.Text>{label ?? t("states.loading")}</Typography.Text>
    </div>
  );
};

export const ErrorState = ({ message, actionLabel, onAction, busy = false }) => {
  const { t } = useTranslation("common");

  return (
    <Alert
      type="error"
      showIcon
      message={message ?? t("states.error")}
      action={onAction ? (
        <Button size="small" disabled={busy} onClick={onAction}>
          {actionLabel ?? t("actions.retry")}
        </Button>
      ) : null}
    />
  );
};

export const EmptyState = ({ message }) => {
  const { t } = useTranslation("common");

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={message ?? t("states.empty")}
      style={{ padding: "32px 0" }}
    />
  );
};

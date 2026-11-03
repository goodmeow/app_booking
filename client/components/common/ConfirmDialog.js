import React from "react";
import { Button, Modal } from "antd";
import { useTranslation } from "react-i18next";

const ConfirmDialog = ({ open, title, message, loading = false, onCancel, onConfirm }) => {
  const { t } = useTranslation("common");

  return (
    <Modal
      open={open}
      title={title ?? t("dialogs.confirmDelete")}
      width={420}
      onCancel={loading ? undefined : onCancel}
      maskClosable={!loading}
      closable={!loading}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          {t("actions.cancel")}
        </Button>,
        <Button key="confirm" type="primary" danger loading={loading} onClick={onConfirm}>
          {loading ? t("states.loading") : t("actions.confirm")}
        </Button>,
      ]}
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
};

export default ConfirmDialog;

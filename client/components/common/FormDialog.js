import React from "react";
import { Button, Modal } from "antd";
import { useTranslation } from "react-i18next";

const dialogWidth = {
  xs: 420,
  sm: 600,
  md: 880,
  lg: 1100,
  xl: 1300,
};

const FormDialog = ({
  open,
  title,
  children,
  formId = "entity-form",
  loading = false,
  submitDisabled = false,
  submitLabel,
  onClose,
  onSubmit,
  maxWidth = "sm",
}) => {
  const { t } = useTranslation("common");

  return (
    <Modal
      open={open}
      title={title}
      width={dialogWidth[maxWidth] || dialogWidth.sm}
      onCancel={loading ? undefined : onClose}
      maskClosable={!loading}
      closable={!loading}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          {t("actions.cancel")}
        </Button>,
        <Button
          key="submit"
          type="primary"
          htmlType="submit"
          form={formId}
          loading={loading}
          disabled={submitDisabled}
        >
          {loading ? t("states.loading") : submitLabel ?? t("actions.save")}
        </Button>,
      ]}
    >
      <form id={formId} onSubmit={onSubmit} noValidate>
        {children}
      </form>
    </Modal>
  );
};

export default FormDialog;

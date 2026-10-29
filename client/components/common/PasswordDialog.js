import React, { useEffect, useState } from "react";
import { Alert, Input, Space } from "antd";
import { useTranslation } from "react-i18next";
import FormDialog from "./FormDialog.js";

const emptyForm = { oldPassword: "", newPassword: "", newPasswordConfirmation: "" };

const PasswordDialog = ({ open, requireOldPassword = true, loading = false, error = "", onClose, onSubmit }) => {
  const { t } = useTranslation(["auth", "common"]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) setForm(emptyForm);
  }, [open]);

  const field = (name) => ({
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <FormDialog
      open={open}
      title={t("password.title")}
      formId="password-form"
      loading={loading}
      submitLabel={t("common:actions.changePassword")}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 8 }}>
        {error && <Alert type="error" showIcon message={error} />}
        {requireOldPassword && (
          <Input.Password
            required
            placeholder={t("common:fields.oldPassword")}
            {...field("oldPassword")}
          />
        )}
        <Input.Password
          required
          placeholder={t("common:fields.newPassword")}
          {...field("newPassword")}
        />
        <Input.Password
          required
          placeholder={t("common:fields.confirmPassword")}
          {...field("newPasswordConfirmation")}
        />
        <Alert type="info" message={t("common:messages.passwordRule")} />
      </Space>
    </FormDialog>
  );
};

export default PasswordDialog;

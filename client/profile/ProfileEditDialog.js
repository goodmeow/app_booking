import React from "react";
import { Alert, Form, Input, Space } from "antd";
import { useTranslation } from "react-i18next";
import FormDialog from "../components/common/FormDialog.js";

const ProfileEditDialog = ({ open, form, setForm, error, isSaving, onClose, onSubmit }) => {
  const { t } = useTranslation(["auth", "common"]);

  const changeField = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
  };

  return (
    <FormDialog
      open={open}
      title={t("auth:profile.edit")}
      formId="profile-edit-form"
      loading={isSaving}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Form component={false} layout="vertical" style={{ marginTop: 8 }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {error ? <Alert type="error" showIcon message={error} /> : null}
          <Form.Item label={t("common:fields.name")} required style={{ marginBottom: 0 }}>
            <Input autoFocus value={form.name} onChange={changeField("name")} />
          </Form.Item>
          <Form.Item label={t("common:fields.email")} required style={{ marginBottom: 0 }}>
            <Input type="email" value={form.email} onChange={changeField("email")} />
          </Form.Item>
        </Space>
      </Form>
    </FormDialog>
  );
};

export default ProfileEditDialog;

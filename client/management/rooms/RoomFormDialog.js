import React from "react";
import { Alert, Form, Input, Space } from "antd";
import FormDialog from "../../components/common/FormDialog.js";
import { LoadingState } from "../../components/common/AsyncState.js";
import { getApiError } from "../../domain/api-error.js";

const RoomFormDialog = ({
  open,
  mode,
  form,
  setForm,
  error,
  detailError,
  isDetailLoading,
  isSaving,
  submitDisabled,
  onClose,
  onSubmit,
  t,
}) => {
  const isCreating = mode === "create";
  const isEditing = mode === "edit";

  const changeField = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
  };

  return (
    <FormDialog
      open={open}
      title={t(isCreating ? "rooms.createTitle" : "rooms.editTitle")}
      formId="room-form"
      loading={isSaving || (isEditing && isDetailLoading)}
      submitDisabled={submitDisabled}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {isEditing && isDetailLoading ? <LoadingState label={t("rooms.loadingOne")} /> : (
        <Form component={false} layout="vertical" style={{ marginTop: 8 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {error ? <Alert type="error" showIcon message={error} /> : null}
            {isEditing && detailError ? (
              <Alert type="error" showIcon message={getApiError(detailError, t("rooms.loadOneError"))} />
            ) : null}
            <Form.Item label={t("common:fields.name")} required style={{ marginBottom: 0 }}>
              <Input value={form.name} onChange={changeField("name")} />
            </Form.Item>
            <Form.Item label={t("common:fields.email")} required style={{ marginBottom: 0 }}>
              <Input type="email" value={form.email} onChange={changeField("email")} />
            </Form.Item>
            {isCreating ? (
              <Form.Item label={t("common:fields.password")} required style={{ marginBottom: 0 }}>
                <Input.Password value={form.password} onChange={changeField("password")} />
              </Form.Item>
            ) : null}
            <Form.Item label={t("rooms.floor")} style={{ marginBottom: 0 }}>
              <Input value={form.floor} onChange={changeField("floor")} />
            </Form.Item>
            <Form.Item label={t("rooms.building")} style={{ marginBottom: 0 }}>
              <Input value={form.building} onChange={changeField("building")} />
            </Form.Item>
            <Form.Item label={t("rooms.capacity")} style={{ marginBottom: 0 }}>
              <Input value={form.capacity} onChange={changeField("capacity")} />
            </Form.Item>
            <Form.Item label={t("rooms.feature")} style={{ marginBottom: 0 }}>
              <Input value={form.feature} onChange={changeField("feature")} />
            </Form.Item>
          </Space>
        </Form>
      )}
    </FormDialog>
  );
};

export default RoomFormDialog;

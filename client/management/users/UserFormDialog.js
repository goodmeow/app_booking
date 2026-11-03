import React from "react";
import { Alert, Form, Input, Select, Space, Switch, Typography } from "antd";
import FormDialog from "../../components/common/FormDialog.js";
import { LoadingState } from "../../components/common/AsyncState.js";
import { getApiError } from "../../domain/api-error.js";
import { ROLE_IDS, ROLE_LABELS, ROLE_OPTIONS } from "../../domain/roles.js";
import { EMPLOYEE_ID_MAX_LENGTH, employeeIdErrorKey } from "../user-form.js";

const UserFormDialog = ({
  open,
  mode,
  form,
  setForm,
  formError,
  detailError,
  isDetailLoading,
  isSaving,
  isProtectedAccount = false,
  floorOptions,
  onClose,
  onSubmit,
  t,
}) => {
  const isCreating = mode === "create";
  const isEditing = mode === "edit";
  // Empty input is only reported on submit; a wrong format is flagged while typing.
  const employeeIdError = form.employee_id ? employeeIdErrorKey(form.employee_id) : null;

  const formField = (name) => ({
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  });

  const floorChoices = [
    { value: "all", label: t("users.floorAll") },
    ...floorOptions.map((floor) => ({
      value: floor,
      label: t("users.floorValue", { floor }),
    })),
    ...form.floors
      .filter((floor) => floor !== "all" && !floorOptions.includes(floor))
      .map((floor) => ({
        value: floor,
        label: t("users.floorValue", { floor }),
      })),
  ];

  const roleChoices = ROLE_OPTIONS.map((role) => ({
    value: role.value,
    label: t(`common:${role.labelKey}`),
  }));

  if (isProtectedAccount && form.roleId === ROLE_IDS.SUPER_ADMIN) {
    roleChoices.unshift({
      value: ROLE_IDS.SUPER_ADMIN,
      label: t(`common:${ROLE_LABELS[ROLE_IDS.SUPER_ADMIN]}`),
    });
  }

  return (
    <FormDialog
      open={open}
      title={t(isCreating ? "users.createTitle" : "users.editTitle")}
      formId="user-management-form"
      loading={isSaving || (isEditing && isDetailLoading)}
      submitLabel={t(isCreating ? "common:actions.create" : "common:actions.save")}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {isEditing && isDetailLoading ? <LoadingState label={t("users.loadingOne")} /> : (
        <Form component={false} layout="vertical" style={{ marginTop: 8 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {formError ? <Alert type="error" showIcon message={formError} /> : null}
            {isEditing && detailError ? (
              <Alert type="error" showIcon message={getApiError(detailError, t("users.loadOneError"))} />
            ) : null}

            <Form.Item
              label={t("users.employeeId")}
              required
              validateStatus={employeeIdError ? "error" : undefined}
              help={employeeIdError ? t(employeeIdError) : t("users.employeeIdHelp")}
              style={{ marginBottom: 0 }}
            >
              <Input
                autoFocus
                maxLength={EMPLOYEE_ID_MAX_LENGTH}
                {...formField("employee_id")}
              />
            </Form.Item>

            <Form.Item label={t("common:fields.name")} required style={{ marginBottom: 0 }}>
              <Input {...formField("name")} />
            </Form.Item>

            <Form.Item label={t("common:fields.email")} required style={{ marginBottom: 0 }}>
              <Input type="email" {...formField("email")} />
            </Form.Item>

            <Form.Item label={t("common:fields.usernameOptional")} style={{ marginBottom: 0 }}>
              <Input {...formField("username")} />
            </Form.Item>

            <Form.Item
              label={t("users.floorGroup")}
              help={t("users.floorHelp")}
              style={{ marginBottom: 0 }}
            >
              <Select
                mode="multiple"
                value={form.floors}
                options={floorChoices}
                placeholder={t("users.floorUnset")}
                onChange={(values) => setForm((current) => ({ ...current, floors: values }))}
              />
            </Form.Item>

            {isCreating ? (
              <Form.Item
                label={t("common:fields.password")}
                required
                help={t("users.passwordRule")}
                style={{ marginBottom: 0 }}
              >
                <Input.Password {...formField("password")} />
              </Form.Item>
            ) : null}

            <Form.Item
              label={t("users.cardNumber")}
              help={t("users.cardNumberHelp")}
              style={{ marginBottom: 0 }}
            >
              <Input {...formField("card_number")} />
            </Form.Item>

            <Form.Item label={t("users.masterCard")} style={{ marginBottom: 0 }}>
              <Switch
                checked={Boolean(form.master_card)}
                onChange={(checked) => setForm((current) => ({ ...current, master_card: checked }))}
              />
            </Form.Item>

            <Form.Item
              label={t("common:fields.role")}
              required
              help={isProtectedAccount ? t("users.protectedRoleHelp") : undefined}
              style={{ marginBottom: 0 }}
            >
              <Select
                value={form.roleId}
                options={roleChoices}
                disabled={isProtectedAccount}
                onChange={(value) => setForm((current) => ({ ...current, roleId: value }))}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space direction="vertical" size={2}>
                <Space>
                  <Switch
                    checked={Boolean(form.must_change_password)}
                    onChange={(checked) => setForm((current) => ({ ...current, must_change_password: checked }))}
                  />
                  <Typography.Text>{t("users.mustChangePassword")}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">{t("users.mustChangePasswordHelp")}</Typography.Text>
              </Space>
            </Form.Item>
          </Space>
        </Form>
      )}
    </FormDialog>
  );
};

export default UserFormDialog;

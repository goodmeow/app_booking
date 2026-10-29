import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Space, Table, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import { useGetMenuMatrixQuery, useUpdateMenuMatrixMutation } from "../redux/services/access.js";

const roleLabelKey = {
  super_admin: "common:roles.superAdmin",
  admin: "common:roles.admin",
  receptionist: "common:roles.receptionist",
  user: "common:roles.user",
};

const menuLabelKey = {
  calendar: "settings.roleAccess.menu.calendar",
  report: "settings.roleAccess.menu.report",
  users: "settings.roleAccess.menu.users",
  rooms: "settings.roleAccess.menu.rooms",
  devices: "settings.roleAccess.menu.devices",
  settings: "settings.roleAccess.menu.settings",
};

const accessKey = (roleName, menuKey) => `${roleName}:${menuKey}`;

const formFromMatrix = (matrix) => {
  const form = {};
  for (const row of matrix?.access || []) form[accessKey(row.role_name, row.menu_key)] = row.allowed;
  return form;
};

const RoleAccessMatrix = () => {
  const { t } = useTranslation(["management", "common"]);
  const { data, isLoading, isError, error, refetch } = useGetMenuMatrixQuery();
  const [updateMatrix, { isLoading: saving }] = useUpdateMenuMatrixMutation();
  const [form, setForm] = useState({});
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setForm(formFromMatrix(data));
  }, [data]);

  const rows = useMemo(
    () => (data?.roles || []).filter((role) => role.role_id),
    [data]
  );

  const toggle = (roleName, menuKey) => {
    setForm((current) => ({
      ...current,
      [accessKey(roleName, menuKey)]: !current[accessKey(roleName, menuKey)],
    }));
  };

  const save = async () => {
    setFeedback(null);
    const access = [];
    for (const role of rows) {
      if (role.role_name === "super_admin") continue;
      for (const menuKey of data?.menus || []) {
        access.push({
          role_name: role.role_name,
          menu_key: menuKey,
          allowed: form[accessKey(role.role_name, menuKey)] === true,
        });
      }
    }
    try {
      await updateMatrix(access).unwrap();
      setFeedback({ severity: "success", message: t("settings.roleAccess.saved") });
    } catch (saveError) {
      setFeedback({ severity: "error", message: getApiError(saveError, t("settings.roleAccess.saveError")) });
    }
  };

  if (isLoading) return <Typography.Text>{t("settings.roleAccess.loading")}</Typography.Text>;
  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={getApiError(error, t("settings.roleAccess.loadError"))}
        action={<Button size="small" onClick={refetch}>{t("common:actions.retry")}</Button>}
      />
    );
  }

  const columns = [
    {
      title: t("settings.roleAccess.role"),
      dataIndex: "role_name",
      key: "role_name",
      fixed: "left",
      width: 180,
      render: (roleName) => (
        <Typography.Text strong={roleName === "super_admin"}>
          {t(roleLabelKey[roleName] || roleName)}
        </Typography.Text>
      ),
    },
    ...(data?.menus || []).map((menuKey) => ({
      title: t(menuLabelKey[menuKey]),
      key: menuKey,
      align: "center",
      width: 120,
      render: (_, row) => {
        const fixed = row.role_name === "super_admin";
        const checked = fixed || form[accessKey(row.role_name, menuKey)] === true;
        return (
          <Checkbox
            checked={checked}
            disabled={fixed || saving}
            onChange={() => toggle(row.role_name, menuKey)}
            aria-label={t("settings.roleAccess.toggleAria", {
              role: t(roleLabelKey[row.role_name] || row.role_name),
              menu: t(menuLabelKey[menuKey]),
            })}
          />
        );
      },
    })),
  ];

  return (
    <section>
      <Typography.Paragraph type="secondary">{t("settings.roleAccess.description")}</Typography.Paragraph>

      <Table
        size="small"
        rowKey="role_name"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 900 }}
      />

      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
        {t("settings.roleAccess.superAdminHint")}
      </Typography.Text>

      {feedback ? (
        <Alert type={feedback.severity} showIcon message={feedback.message} style={{ marginTop: 16 }} />
      ) : null}

      <Space style={{ width: "100%", justifyContent: "flex-end", marginTop: 16 }}>
        <Button type="primary" onClick={save} loading={saving}>
          {saving ? t("settings.roleAccess.saving") : t("settings.roleAccess.save")}
        </Button>
      </Space>
    </section>
  );
};

export default RoleAccessMatrix;

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
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

  if (isLoading) return <Typography>{t("settings.roleAccess.loading")}</Typography>;
  if (isError) {
    return (
      <Alert
        severity="error"
        action={<Button color="inherit" size="small" onClick={refetch}>{t("common:actions.retry")}</Button>}
      >
        {getApiError(error, t("settings.roleAccess.loadError"))}
      </Alert>
    );
  }

  return (
    <Box component="section">
      <Typography variant="h6" component="h2" gutterBottom>
        {t("settings.roleAccess.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.roleAccess.description")}
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={t("settings.roleAccess.title")}>
          <TableHead>
            <TableRow>
              <TableCell>{t("settings.roleAccess.role")}</TableCell>
              {(data?.menus || []).map((menuKey) => (
                <TableCell key={menuKey} align="center">
                  {t(menuLabelKey[menuKey])}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((role) => {
              const fixed = role.role_name === "super_admin";
              return (
                <TableRow key={role.role_name} hover>
                  <TableCell component="th" scope="row">
                    <Typography variant="body2" fontWeight={fixed ? 700 : 500}>
                      {t(roleLabelKey[role.role_name] || role.role_name)}
                    </Typography>
                  </TableCell>
                  {(data?.menus || []).map((menuKey) => {
                    const checked = fixed || form[accessKey(role.role_name, menuKey)] === true;
                    return (
                      <TableCell key={menuKey} align="center" padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={checked}
                          disabled={fixed || saving}
                          onChange={() => toggle(role.role_name, menuKey)}
                          inputProps={{
                            "aria-label": t("settings.roleAccess.toggleAria", {
                              role: t(roleLabelKey[role.role_name] || role.role_name),
                              menu: t(menuLabelKey[menuKey]),
                            }),
                          }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {t("settings.roleAccess.superAdminHint")}
      </Typography>

      {feedback ? <Alert severity={feedback.severity} sx={{ mt: 2 }}>{feedback.message}</Alert> : null}

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? t("settings.roleAccess.saving") : t("settings.roleAccess.save")}
        </Button>
      </Stack>
    </Box>
  );
};

export default RoleAccessMatrix;

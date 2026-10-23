import React, { useEffect, useState } from "react";
import { Alert, Stack, TextField } from "@mui/material";
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
      <Stack spacing={2} sx={{ mt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {requireOldPassword && <TextField required type="password" label={t("common:fields.oldPassword")} {...field("oldPassword")} />}
        <TextField
          required
          type="password"
          label={t("common:fields.newPassword")}
          helperText={t("common:messages.passwordRule")}
          {...field("newPassword")}
        />
        <TextField required type="password" label={t("common:fields.confirmPassword")} {...field("newPasswordConfirmation")} />
      </Stack>
    </FormDialog>
  );
};

export default PasswordDialog;

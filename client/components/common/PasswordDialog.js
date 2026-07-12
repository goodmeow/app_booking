import React, { useEffect, useState } from "react";
import { Alert, Stack, TextField } from "@mui/material";
import FormDialog from "./FormDialog.js";

const emptyForm = { oldPassword: "", newPassword: "", newPasswordConfirmation: "" };

const PasswordDialog = ({ open, requireOldPassword = true, loading = false, error = "", onClose, onSubmit }) => {
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
      title="Change Password"
      formId="password-form"
      loading={loading}
      submitLabel="Change Password"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {requireOldPassword && <TextField required type="password" label="Old Password" {...field("oldPassword")} />}
        <TextField required type="password" label="New Password" {...field("newPassword")} />
        <TextField required type="password" label="Confirmation Password" {...field("newPasswordConfirmation")} />
      </Stack>
    </FormDialog>
  );
};

export default PasswordDialog;

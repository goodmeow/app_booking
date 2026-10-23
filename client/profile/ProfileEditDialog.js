import React from "react";
import { Alert, Stack, TextField } from "@mui/material";
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
      <Stack spacing={2} sx={{ mt: 1 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField required autoFocus label={t("common:fields.name")} value={form.name} onChange={changeField("name")} />
        <TextField required type="email" label={t("common:fields.email")} value={form.email} onChange={changeField("email")} />
      </Stack>
    </FormDialog>
  );
};

export default ProfileEditDialog;

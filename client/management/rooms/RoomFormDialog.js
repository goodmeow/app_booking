import React from "react";
import { Alert, Stack, TextField } from "@mui/material";
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
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {isEditing && detailError ? (
            <Alert severity="error">{getApiError(detailError, t("rooms.loadOneError"))}</Alert>
          ) : null}
          <TextField required label={t("common:fields.name")} value={form.name} onChange={changeField("name")} />
          <TextField required type="email" label={t("common:fields.email")} value={form.email} onChange={changeField("email")} />
          {isCreating ? (
            <TextField required type="password" label={t("common:fields.password")} value={form.password} onChange={changeField("password")} />
          ) : null}
          <TextField label={t("rooms.floor")} value={form.floor} onChange={changeField("floor")} />
          <TextField label={t("rooms.building")} value={form.building} onChange={changeField("building")} />
          <TextField label={t("rooms.capacity")} value={form.capacity} onChange={changeField("capacity")} />
          <TextField label={t("rooms.feature")} value={form.feature} onChange={changeField("feature")} />
        </Stack>
      )}
    </FormDialog>
  );
};

export default RoomFormDialog;

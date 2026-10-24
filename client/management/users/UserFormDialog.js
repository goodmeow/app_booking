import React from "react";
import {
  Alert,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import FormDialog from "../../components/common/FormDialog.js";
import { LoadingState } from "../../components/common/AsyncState.js";
import { getApiError } from "../../domain/api-error.js";
import { ROLE_OPTIONS } from "../../domain/roles.js";
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
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          {isEditing && detailError ? (
            <Alert severity="error">{getApiError(detailError, t("users.loadOneError"))}</Alert>
          ) : null}
          <TextField
            required
            autoFocus
            label={t("users.employeeId")}
            helperText={employeeIdError ? t(employeeIdError) : t("users.employeeIdHelp")}
            error={Boolean(employeeIdError)}
            inputProps={{ maxLength: EMPLOYEE_ID_MAX_LENGTH }}
            {...formField("employee_id")}
          />
          <TextField required label={t("common:fields.name")} {...formField("name")} />
          <TextField required type="email" label={t("common:fields.email")} {...formField("email")} />
          <TextField label={t("common:fields.usernameOptional")} {...formField("username")} />
          <TextField
            select
            label={t("users.floorGroup")}
            helperText={t("users.floorHelp")}
            {...formField("floor")}
          >
            <MenuItem value="">{t("users.floorUnset")}</MenuItem>
            <MenuItem value="all">{t("users.floorAll")}</MenuItem>
            {floorOptions.map((floor) => (
              <MenuItem key={floor} value={floor}>{t("users.floorValue", { floor })}</MenuItem>
            ))}
          </TextField>
          {isCreating ? (
            <TextField
              required
              type="password"
              label={t("common:fields.password")}
              helperText={t("users.passwordRule")}
              {...formField("password")}
            />
          ) : null}
          <TextField
            label={t("users.cardNumber")}
            helperText={t("users.cardNumberHelp")}
            {...formField("card_number")}
          />
          <FormControlLabel
            control={(
              <Switch
                checked={Boolean(form.master_card)}
                onChange={(event) => setForm((current) => ({ ...current, master_card: event.target.checked }))}
              />
            )}
            label={t("users.masterCard")}
          />
          <TextField required select label={t("common:fields.role")} {...formField("roleId")}>
            {ROLE_OPTIONS.map((role) => (
              <MenuItem key={role.value} value={role.value}>{t(`common:${role.labelKey}`)}</MenuItem>
            ))}
          </TextField>
          <div>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.must_change_password)}
                  onChange={(event) => setForm((current) => ({ ...current, must_change_password: event.target.checked }))}
                />
              }
              label={t("users.mustChangePassword")}
            />
            <Typography variant="body2" color="text.secondary">
              {t("users.mustChangePasswordHelp")}
            </Typography>
          </div>
        </Stack>
      )}
    </FormDialog>
  );
};

export default UserFormDialog;

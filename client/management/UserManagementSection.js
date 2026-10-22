import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIconModule from "@mui/icons-material/Add";
import DeleteIconModule from "@mui/icons-material/Delete";
import EditIconModule from "@mui/icons-material/Edit";
import PasswordIconModule from "@mui/icons-material/Password";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FormDialog from "../components/common/FormDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import LocalizedDataGrid from "../components/common/LocalizedDataGrid.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { isAuthenticated } from "../auth/auth-helper.js";
import { getApiError } from "../domain/api-error.js";
import { ROLE_IDS, ROLE_OPTIONS } from "../domain/roles.js";
import { createEmptyUserForm } from "./user-form.js";
import {
  useChangePasswordMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useDetailUserQuery,
  useListUserQuery,
  useUpdateUserMutation,
} from "../redux/services/users.js";
import { useGetRoomsQuery } from "../redux/services/rooms.js";

const AddIcon = resolveMuiIcon(AddIconModule);
const DeleteIcon = resolveMuiIcon(DeleteIconModule);
const EditIcon = resolveMuiIcon(EditIconModule);
const PasswordIcon = resolveMuiIcon(PasswordIconModule);

const UserManagementSection = () => {
  const { t } = useTranslation(["management", "common", "auth"]);
  const { data, isLoading, isFetching, isError, error, refetch } = useListUserQuery();
  const users = Array.isArray(data) ? data : [];
  const roomsQuery = useGetRoomsQuery();
  // Pilihan grup lantai diambil dari lantai ruangan yang ada.
  const floorOptions = useMemo(() => {
    const seen = new Set();
    for (const room of roomsQuery.data || []) {
      const floor = String(room.floor ?? "").trim();
      if (floor) seen.add(floor);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [roomsQuery.data]);

  const [formMode, setFormMode] = useState(null);
  const [form, setForm] = useState(createEmptyUserForm);
  const [formError, setFormError] = useState("");
  const [editUserId, setEditUserId] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [feedback, setFeedback] = useState({ open: false, message: "", severity: "success" });

  const {
    data: editUser,
    isFetching: isDetailLoading,
    isError: isDetailError,
    error: detailError,
  } = useDetailUserQuery(editUserId, { skip: !editUserId });

  const [createUser, { isLoading: isCreating, reset: resetCreate }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating, reset: resetUpdate }] = useUpdateUserMutation();
  const [changePassword, { isLoading: isChangingPassword, reset: resetPassword }] = useChangePasswordMutation();
  const [deleteUser, { isLoading: isDeleting, reset: resetDelete }] = useDeleteUserMutation();
  const session = isAuthenticated();

  useEffect(() => {
    if (!editUser || editUser._id !== editUserId) return;
    setForm({
      name: editUser.name || "",
      email: editUser.email || "",
      username: editUser.username || "",
      password: "",
      card_number: editUser.card_number || "",
      master_card: Boolean(editUser.is_master_card),
      floor: editUser.floor || "",
      roleId: editUser.role_id || ROLE_IDS.USER,
    });
  }, [editUser, editUserId]);

  const closeForm = () => {
    if (isCreating || isUpdating) return;
    setFormMode(null);
    setEditUserId(null);
    setForm(createEmptyUserForm());
    setFormError("");
    resetCreate();
    resetUpdate();
  };

  const openCreate = () => {
    resetCreate();
    resetUpdate();
    setEditUserId(null);
    setForm(createEmptyUserForm());
    setFormError("");
    setFormMode("create");
  };

  const openEdit = (user) => {
    resetCreate();
    resetUpdate();
    setEditUserId(user._id);
    setForm({ ...createEmptyUserForm(), name: user.name || "", email: user.email || "", username: user.username || "" });
    setFormError("");
    setFormMode("edit");
  };

  const showFeedback = (message, severity = "success") => {
    setFeedback({ open: true, message, severity });
  };

  const submitUser = async (event) => {
    event.preventDefault();
    setFormError("");

    if (formMode === "edit" && isDetailError) {
      setFormError(getApiError(detailError, t("users.loadOneError")));
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || !form.roleId || (formMode === "create" && !form.password)) {
      setFormError(t("users.required"));
      return;
    }

    const cardNumber = form.card_number.trim();
    if (form.master_card && !cardNumber) {
      setFormError(t("users.masterCardNeedsCard"));
      return;
    }

    const body = {
      name,
      email,
      username: form.username.trim(),
      card_number: cardNumber,
      master_card: Boolean(form.master_card),
      floor: form.floor,
      roleId: form.roleId,
    };

    try {
      if (formMode === "create") {
        await createUser({ ...body, password: form.password }).unwrap();
        showFeedback(t("users.created"));
      } else {
        await updateUser({ userId: editUserId, ...body }).unwrap();
        showFeedback(t("users.updated"));
      }
      setFormMode(null);
      setEditUserId(null);
      setForm(createEmptyUserForm());
      setFormError("");
      resetCreate();
      resetUpdate();
    } catch (mutationError) {
      setFormError(getApiError(mutationError, t(formMode === "create" ? "users.createError" : "users.updateError")));
    }
  };

  const submitPassword = async ({ oldPassword, newPassword, newPasswordConfirmation }) => {
    setPasswordError("");
    if (newPassword !== newPasswordConfirmation) {
      setPasswordError(t("auth:password.mismatch"));
      return;
    }

    try {
      await changePassword({
        userId: passwordUser._id,
        ...(passwordUser._id === session?.user?._id ? { oldPassword } : {}),
        newPassword,
        newPasswordConfirmation,
      }).unwrap();
      setPasswordUser(null);
      resetPassword();
      showFeedback(t("users.passwordChanged"));
    } catch (mutationError) {
      setPasswordError(getApiError(mutationError, t("users.passwordError")));
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteUser(deleteUserTarget._id).unwrap();
      setDeleteUserTarget(null);
      setDeleteError("");
      resetDelete();
      showFeedback(t("users.deleted"));
    } catch (mutationError) {
      setDeleteError(getApiError(mutationError, t("users.deleteError")));
    }
  };

  const toggleMasterCard = async (row, enabled) => {
    try {
      await updateUser({ userId: row._id, card_number: row.card_number || "", master_card: enabled }).unwrap();
      showFeedback(enabled ? t("users.masterCardEnabled") : t("users.masterCardDisabled"));
    } catch (mutationError) {
      showFeedback(getApiError(mutationError, t("users.updateError")), "error");
    }
  };

  const changeFloor = async (row, floor) => {
    try {
      await updateUser({ userId: row._id, floor }).unwrap();
      showFeedback(t("users.floorUpdated"));
    } catch (mutationError) {
      showFeedback(getApiError(mutationError, t("users.updateError")), "error");
    }
  };

  const floorLabel = (value) => {
    if (value === "all") return t("users.floorAll");
    if (!value) return t("users.floorUnset");
    return t("users.floorValue", { floor: value });
  };

  const columns = useMemo(() => [
    { field: "name", headerName: t("common:fields.name"), flex: 1, minWidth: 140 },
    { field: "email", headerName: t("common:fields.email"), flex: 1.25, minWidth: 190 },
    {
      field: "floor",
      headerName: t("users.floorGroup"),
      minWidth: 170,
      sortable: true,
      filterable: false,
      valueGetter: ({ row }) => floorLabel(row.floor),
      renderCell: ({ row }) => (
        <TextField
          select
          size="small"
          value={row.floor || ""}
          onChange={(event) => void changeFloor(row, event.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">{t("users.floorUnset")}</MenuItem>
          <MenuItem value="all">{t("users.floorAll")}</MenuItem>
          {floorOptions.map((floor) => (
            <MenuItem key={floor} value={floor}>{t("users.floorValue", { floor })}</MenuItem>
          ))}
        </TextField>
      ),
    },
    {
      field: "card_number",
      headerName: t("users.cardNumber"),
      minWidth: 150,
      flex: 0.8,
      renderCell: ({ row }) => row.card_number
        ? <span>{row.card_number}</span>
        : <Chip size="small" label={t("users.cardMissing")} />,
    },
    {
      field: "is_master_card",
      headerName: t("users.masterCard"),
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Tooltip title={row.card_number ? t("users.masterCardHelp") : t("users.masterCardNeedsCard")}>
          <span>
            <Switch
              size="small"
              checked={Boolean(row.is_master_card)}
              disabled={!row.card_number || isUpdating}
              inputProps={{ "aria-label": t("users.masterCardAria", { name: row.name }) }}
              onChange={(event) => void toggleMasterCard(row, event.target.checked)}
            />
          </span>
        </Tooltip>
      ),
    },
    {
      field: "actions",
      headerName: t("common:fields.action"),
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title={t("users.editTooltip")}>
            <IconButton aria-label={t("users.editAria", { name: row.name })} size="small" onClick={() => openEdit(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("users.passwordTooltip")}>
            <IconButton
              aria-label={t("users.passwordAria", { name: row.name })}
              size="small"
              onClick={() => {
                resetPassword();
                setPasswordError("");
                setPasswordUser(row);
              }}
            >
              <PasswordIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("users.deleteTooltip")}>
            <IconButton
              aria-label={t("users.deleteAria", { name: row.name })}
              size="small"
              color="error"
              onClick={() => {
                resetDelete();
                setDeleteError("");
                setDeleteUserTarget(row);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [floorOptions, isUpdating, resetDelete, resetPassword, t]);

  const formField = (name) => ({
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2">{t("users.title")}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>{t("users.add")}</Button>
      </Stack>

      {isFetching && !isLoading && users.length > 0 ? <Alert severity="info" sx={{ mb: 1 }}>{t("common:states.refreshing")}</Alert> : null}
      {isLoading ? <LoadingState label={t("users.loading")} /> : null}
      {isError ? <ErrorState message={getApiError(error, t("users.loadError"))} busy={isFetching} onAction={refetch} /> : null}
      {!isLoading && (!isError || users.length > 0) && users.length === 0 ? <EmptyState message={t("users.empty")} /> : null}
      {!isLoading && (!isError || users.length > 0) && users.length > 0 ? (
        <LocalizedDataGrid
          autoHeight
          rows={users}
          columns={columns}
          getRowId={(row) => row._id}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
          pageSizeOptions={[5]}
          density="compact"
          disableRowSelectionOnClick
        />
      ) : null}

      <FormDialog
        open={Boolean(formMode)}
        title={t(formMode === "create" ? "users.createTitle" : "users.editTitle")}
        formId="user-management-form"
        loading={isCreating || isUpdating || (formMode === "edit" && isDetailLoading)}
        submitLabel={t(formMode === "create" ? "common:actions.create" : "common:actions.save")}
        onClose={closeForm}
        onSubmit={submitUser}
      >
        {formMode === "edit" && isDetailLoading ? <LoadingState label={t("users.loadingOne")} /> : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            {formMode === "edit" && isDetailError ? (
              <Alert severity="error">{getApiError(detailError, t("users.loadOneError"))}</Alert>
            ) : null}
            <TextField required label={t("common:fields.name")} autoFocus {...formField("name")} />
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
            {formMode === "create" ? (
              <TextField required type="password" label={t("common:fields.password")} {...formField("password")} />
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
          </Stack>
        )}
      </FormDialog>

      <PasswordDialog
        open={Boolean(passwordUser)}
        requireOldPassword={passwordUser?._id === session?.user?._id}
        loading={isChangingPassword}
        error={passwordError}
        onClose={() => {
          if (isChangingPassword) return;
          setPasswordUser(null);
          setPasswordError("");
          resetPassword();
        }}
        onSubmit={submitPassword}
      />

      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        title={t("users.deleteTitle")}
        message={deleteError || t("users.deleteMessage", { name: deleteUserTarget?.name || "" })}
        loading={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteUserTarget(null);
          setDeleteError("");
          resetDelete();
        }}
        onConfirm={confirmDelete}
      />

      <FeedbackSnackbar
        open={feedback.open}
        message={feedback.message}
        severity={feedback.severity}
        onClose={() => setFeedback((current) => ({ ...current, open: false }))}
      />
    </Box>
  );
};

export default UserManagementSection;

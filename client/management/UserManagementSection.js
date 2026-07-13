import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PasswordIcon from "@mui/icons-material/Password";
import { DataGrid } from "@mui/x-data-grid";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FormDialog from "../components/common/FormDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { isAuthenticated, isRoomAccountEmail } from "../auth/auth-helper.js";
import { getApiError } from "../domain/api-error.js";
import { ROLE_OPTIONS } from "../domain/roles.js";
import {
  useChangePasswordMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useDetailUserQuery,
  useListUserQuery,
  useUpdateUserMutation,
} from "../redux/services/users.js";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  card_number: "",
  roleId: "",
};

const UserManagementSection = () => {
  const { data, isLoading, isError, error } = useListUserQuery();
  const users = Array.isArray(data) ? data : [];

  const [formMode, setFormMode] = useState(null);
  const [form, setForm] = useState(emptyForm);
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
      password: "",
      card_number: editUser.card_number || "",
      roleId: editUser.role_id || ROLE_OPTIONS[1].value,
    });
  }, [editUser, editUserId]);

  const closeForm = () => {
    if (isCreating || isUpdating) return;
    setFormMode(null);
    setEditUserId(null);
    setForm(emptyForm);
    setFormError("");
    resetCreate();
    resetUpdate();
  };

  const openCreate = () => {
    resetCreate();
    resetUpdate();
    setEditUserId(null);
    setForm(emptyForm);
    setFormError("");
    setFormMode("create");
  };

  const openEdit = (user) => {
    resetCreate();
    resetUpdate();
    setEditUserId(user._id);
    setForm({ ...emptyForm, name: user.name || "", email: user.email || "" });
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
      setFormError(getApiError(detailError, "Unable to load user"));
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || !form.roleId || (formMode === "create" && !form.password)) {
      setFormError("All data must be filled");
      return;
    }

    if (isRoomAccountEmail(email)) {
      setFormError("Email cannot contain @room.com");
      return;
    }

    const body = {
      name,
      email,
      card_number: form.card_number.trim(),
      roleId: form.roleId,
    };

    try {
      if (formMode === "create") {
        await createUser({ ...body, password: form.password }).unwrap();
        showFeedback("User successfully created");
      } else {
        await updateUser({ userId: editUserId, ...body }).unwrap();
        showFeedback("User successfully updated");
      }
      setFormMode(null);
      setEditUserId(null);
      setForm(emptyForm);
      setFormError("");
      resetCreate();
      resetUpdate();
    } catch (mutationError) {
      setFormError(getApiError(mutationError, `Unable to ${formMode} user`));
    }
  };

  const submitPassword = async ({ oldPassword, newPassword, newPasswordConfirmation }) => {
    setPasswordError("");
    if (newPassword !== newPasswordConfirmation) {
      setPasswordError("New password and confirmation password mismatch");
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
      showFeedback("Password successfully changed");
    } catch (mutationError) {
      setPasswordError(getApiError(mutationError, "Unable to change password"));
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteUser(deleteUserTarget._id).unwrap();
      setDeleteUserTarget(null);
      setDeleteError("");
      resetDelete();
      showFeedback("User successfully deleted");
    } catch (mutationError) {
      setDeleteError(getApiError(mutationError, "Unable to delete user"));
    }
  };

  const columns = useMemo(() => [
    { field: "_id", headerName: "User ID", flex: 1.25, minWidth: 220 },
    { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
    { field: "email", headerName: "Email", flex: 1.25, minWidth: 220 },
    {
      field: "actions",
      headerName: "Action",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Edit user">
            <IconButton aria-label={`Edit ${row.name}`} size="small" onClick={() => openEdit(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Change password">
            <IconButton
              aria-label={`Change password for ${row.name}`}
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
          <Tooltip title="Delete user">
            <IconButton
              aria-label={`Delete ${row.name}`}
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
  ], [resetDelete, resetPassword]);

  const formField = (name) => ({
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2">All Users</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add New User</Button>
      </Stack>

      {isLoading ? <LoadingState label="Loading users..." /> : null}
      {isError ? <ErrorState message={getApiError(error, "Unable to load users")} /> : null}
      {!isLoading && !isError && users.length === 0 ? <EmptyState message="No users" /> : null}
      {!isLoading && !isError && users.length > 0 ? (
        <DataGrid
          autoHeight
          rows={users}
          columns={columns}
          getRowId={(row) => row._id}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
          pageSizeOptions={[5]}
          disableRowSelectionOnClick
        />
      ) : null}

      <FormDialog
        open={Boolean(formMode)}
        title={formMode === "create" ? "Add New User" : "Edit User"}
        formId="user-management-form"
        loading={isCreating || isUpdating || (formMode === "edit" && isDetailLoading)}
        submitLabel={formMode === "create" ? "Create" : "Save"}
        onClose={closeForm}
        onSubmit={submitUser}
      >
        {formMode === "edit" && isDetailLoading ? <LoadingState label="Loading user..." /> : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            {formMode === "edit" && isDetailError ? (
              <Alert severity="error">{getApiError(detailError, "Unable to load user")}</Alert>
            ) : null}
            <TextField required label="Name" autoFocus {...formField("name")} />
            <TextField required type="email" label="Email" {...formField("email")} />
            {formMode === "create" ? (
              <TextField required type="password" label="Password" {...formField("password")} />
            ) : null}
            <TextField label="Card Number" {...formField("card_number")} />
            <TextField required select label="Role" {...formField("roleId")}>
              {ROLE_OPTIONS.map((role) => (
                <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
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
        title="Delete User"
        message={deleteError || `Delete ${deleteUserTarget?.name || "this user"}?`}
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

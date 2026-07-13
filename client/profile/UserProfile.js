import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIconModule from "@mui/icons-material/Delete";
import EditIconModule from "@mui/icons-material/Edit";
import LockResetIconModule from "@mui/icons-material/LockReset";
import PersonIconModule from "@mui/icons-material/Person";
import { authenticate, isAuthenticated, signout } from "../auth/auth-helper.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import FormDialog from "../components/common/FormDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { canManageProfile, formatJoinedDate } from "../domain/profile.js";
import {
  useChangePasswordMutation,
  useDeleteUserMutation,
  useDetailUserQuery,
  useUpdateUserMutation,
} from "../redux/services/users.js";

const DeleteIcon = resolveMuiIcon(DeleteIconModule);
const EditIcon = resolveMuiIcon(EditIconModule);
const LockResetIcon = resolveMuiIcon(LockResetIconModule);
const PersonIcon = resolveMuiIcon(PersonIconModule);

const UserProfile = () => {
  const { userId } = useParams();
  const history = useHistory();
  const session = isAuthenticated();
  const isOwner = canManageProfile(session, userId);
  const { data: user, isLoading, isError, error } = useDetailUserQuery(userId);
  const [updateUser, { isLoading: isUpdating, reset: resetUpdate }] = useUpdateUserMutation();
  const [changePassword, { isLoading: isChangingPassword, reset: resetPassword }] = useChangePasswordMutation();
  const [deleteUser, { isLoading: isDeleting, reset: resetDelete }] = useDeleteUserMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editError, setEditError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [feedback, setFeedback] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    setEditOpen(false);
    setPasswordOpen(false);
    setDeleteOpen(false);
    setEditError("");
    setPasswordError("");
    setDeleteError("");
  }, [userId]);

  const showFeedback = (message, severity = "success") => {
    setFeedback({ open: true, message, severity });
  };

  const openEdit = () => {
    resetUpdate();
    setEditError("");
    setEditForm({ name: user?.name || "", email: user?.email || "" });
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (isUpdating) return;
    setEditOpen(false);
    setEditError("");
    resetUpdate();
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    setEditError("");
    const name = editForm.name.trim();
    const email = editForm.email.trim();

    if (!name || !email) {
      setEditError("Name and email must be filled");
      return;
    }
    let updated;
    try {
      updated = await updateUser({ userId: session.user._id, name, email }).unwrap();
    } catch (mutationError) {
      setEditError(getApiError(mutationError, "Unable to update profile"));
      return;
    }

    setEditOpen(false);
    resetUpdate();
    if (email !== session.user.email) {
      void signout(() => history.push("/signin")).catch(() => {});
      return;
    }
    authenticate({
      ...session,
      user: { ...session.user, name: updated?.name || name },
    });
    history.replace(history.location);
    showFeedback("Profile successfully updated");
  };

  const submitPassword = async ({ oldPassword, newPassword, newPasswordConfirmation }) => {
    setPasswordError("");
    if (!oldPassword || !newPassword || !newPasswordConfirmation) {
      setPasswordError("All password fields must be filled");
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setPasswordError("New password and confirmation password mismatch");
      return;
    }

    try {
      await changePassword({
        oldPassword,
        newPassword,
        newPasswordConfirmation,
      }).unwrap();
      setPasswordOpen(false);
      resetPassword();
      showFeedback("Password successfully changed");
    } catch (mutationError) {
      setPasswordError(getApiError(mutationError, "Unable to change password"));
    }
  };

  const confirmDelete = async () => {
    setDeleteError("");
    try {
      await deleteUser(session.user._id).unwrap();
    } catch (mutationError) {
      setDeleteError(getApiError(mutationError, "Unable to delete profile"));
      return;
    }
    resetDelete();
    void signout(() => history.push("/")).catch(() => {});
  };

  if (isLoading) return <LoadingState label="Loading profile..." />;
  if (isError) return <ErrorState message={getApiError(error, "Unable to load profile")} />;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 6 } }}>
      <Card component="main" elevation={2}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3} alignItems="center">
            <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.main" }}>
              <PersonIcon sx={{ fontSize: 52 }} />
            </Avatar>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h4" component="h1">{user?.name || "-"}</Typography>
              <Typography color="text.secondary">{user?.email || "-"}</Typography>
            </Box>
            <Divider flexItem />
            <Typography color="text.secondary">Joined: {formatJoinedDate(user?.created_at)}</Typography>
            {isOwner ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: "100%" }}>
                <Button fullWidth variant="contained" startIcon={<EditIcon />} onClick={openEdit}>
                  Edit Profile
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<LockResetIcon />}
                  onClick={() => {
                    resetPassword();
                    setPasswordError("");
                    setPasswordOpen(true);
                  }}
                >
                  Change Password
                </Button>
                <Button
                  fullWidth
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    resetDelete();
                    setDeleteError("");
                    setDeleteOpen(true);
                  }}
                >
                  Delete
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <FormDialog
        open={editOpen}
        title="Edit Profile"
        formId="profile-edit-form"
        loading={isUpdating}
        onClose={closeEdit}
        onSubmit={submitEdit}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {editError ? <Alert severity="error">{editError}</Alert> : null}
          <TextField
            required
            autoFocus
            label="Name"
            value={editForm.name}
            onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
          />
          <TextField
            required
            type="email"
            label="Email"
            value={editForm.email}
            onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
          />
        </Stack>
      </FormDialog>

      <PasswordDialog
        open={passwordOpen}
        requireOldPassword
        loading={isChangingPassword}
        error={passwordError}
        onClose={() => {
          if (isChangingPassword) return;
          setPasswordOpen(false);
          setPasswordError("");
          resetPassword();
        }}
        onSubmit={submitPassword}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Profile"
        message={deleteError || "Delete your account? This action cannot be undone."}
        loading={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteOpen(false);
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
    </Container>
  );
};

export default UserProfile;

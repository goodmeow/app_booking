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
import { useTranslation } from "react-i18next";
import { authenticate, isAuthenticated, signout } from "../auth/auth-helper.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import FormDialog from "../components/common/FormDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { canManageProfile, formatJoinedDate } from "../domain/profile.js";
import { normalizeLanguage } from "../i18n/languages.js";
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
  const { i18n, t } = useTranslation(["auth", "common"]);
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const { userId } = useParams();
  const history = useHistory();
  const session = isAuthenticated();
  const isOwner = canManageProfile(session, userId);
  const { data: user, isLoading, isFetching, isError, error, refetch } = useDetailUserQuery(userId);
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
      setEditError(t("auth:profile.required"));
      return;
    }
    let updated;
    try {
      updated = await updateUser({ userId: session.user._id, name, email }).unwrap();
    } catch (mutationError) {
      setEditError(getApiError(mutationError, t("auth:profile.updateError")));
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
    showFeedback(t("auth:profile.updateSuccess"));
  };

  const submitPassword = async ({ oldPassword, newPassword, newPasswordConfirmation }) => {
    setPasswordError("");
    if (!oldPassword || !newPassword || !newPasswordConfirmation) {
      setPasswordError(t("auth:password.required"));
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setPasswordError(t("auth:password.mismatch"));
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
      showFeedback(t("auth:password.success"));
    } catch (mutationError) {
      setPasswordError(getApiError(mutationError, t("auth:password.loadError")));
    }
  };

  const confirmDelete = async () => {
    setDeleteError("");
    try {
      await deleteUser(session.user._id).unwrap();
    } catch (mutationError) {
      setDeleteError(getApiError(mutationError, t("auth:profile.deleteError")));
      return;
    }
    resetDelete();
    void signout(() => history.push("/")).catch(() => {});
  };

  if (isLoading) return <LoadingState label={t("auth:profile.loading")} />;
  if (isError) return <ErrorState message={getApiError(error, t("auth:profile.loadError"))} busy={isFetching} onAction={refetch} />;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 6 } }}>
      <Card component="main" elevation={2}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3} alignItems="center">
            <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.main" }}>
              <PersonIcon sx={{ fontSize: 52 }} />
            </Avatar>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h4" component="h1">{user?.name || t("common:states.unknown")}</Typography>
              <Typography color="text.secondary">{user?.email || t("common:states.unknown")}</Typography>
            </Box>
            <Divider flexItem />
            <Typography color="text.secondary">
              {t("auth:profile.joined", { date: formatJoinedDate(user?.created_at, language) })}
            </Typography>
            {isOwner ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: "100%" }}>
                <Button fullWidth variant="contained" startIcon={<EditIcon />} onClick={openEdit}>
                  {t("auth:profile.edit")}
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
                  {t("common:actions.changePassword")}
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
                  {t("common:actions.delete")}
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <FormDialog
        open={editOpen}
        title={t("auth:profile.edit")}
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
            label={t("common:fields.name")}
            value={editForm.name}
            onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
          />
          <TextField
            required
            type="email"
            label={t("common:fields.email")}
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
        title={t("auth:profile.delete")}
        message={deleteError || t("auth:profile.deleteMessage")}
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

import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Box, Card, CardContent, Container } from "@mui/material";
import { useTranslation } from "react-i18next";
import { authenticate, isAuthenticated, signout } from "../auth/auth-helper.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { canManageProfile } from "../domain/profile.js";
import {
  useChangePasswordMutation,
  useDeleteUserMutation,
  useDetailUserQuery,
  useUpdateUserMutation,
} from "../redux/services/users.js";
import ProfileEditDialog from "./ProfileEditDialog.js";
import ProfileSummaryCard from "./ProfileSummaryCard.js";

const UserProfile = () => {
  const { t } = useTranslation(["auth", "common"]);
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

  const openPasswordDialog = () => {
    resetPassword();
    setPasswordError("");
    setPasswordOpen(true);
  };

  const closePasswordDialog = () => {
    if (isChangingPassword) return;
    setPasswordOpen(false);
    setPasswordError("");
    resetPassword();
  };

  const openDeleteDialog = () => {
    resetDelete();
    setDeleteError("");
    setDeleteOpen(true);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) return;
    setDeleteOpen(false);
    setDeleteError("");
    resetDelete();
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
  if (isError && !user) return <ErrorState message={getApiError(error, t("auth:profile.loadError"))} busy={isFetching} onAction={refetch} />;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 6 } }}>
      {isError ? (
        <Box sx={{ mb: 2 }}>
          <ErrorState message={getApiError(error, t("auth:profile.loadError"))} busy={isFetching} onAction={refetch} />
        </Box>
      ) : null}
      <Card component="main" elevation={2}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <ProfileSummaryCard
            user={user}
            isOwner={isOwner}
            onEdit={openEdit}
            onChangePassword={openPasswordDialog}
            onDelete={openDeleteDialog}
          />
        </CardContent>
      </Card>

      <ProfileEditDialog
        open={editOpen}
        form={editForm}
        setForm={setEditForm}
        error={editError}
        isSaving={isUpdating}
        onClose={closeEdit}
        onSubmit={submitEdit}
      />

      <PasswordDialog
        open={passwordOpen}
        requireOldPassword
        loading={isChangingPassword}
        error={passwordError}
        onClose={closePasswordDialog}
        onSubmit={submitPassword}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t("auth:profile.delete")}
        message={deleteError || t("auth:profile.deleteMessage")}
        loading={isDeleting}
        onCancel={closeDeleteDialog}
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

import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Card } from "antd";
import { useTranslation } from "react-i18next";
import { authenticate, isAuthenticated, signout } from "../auth/auth-helper.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { canManageProfile } from "../domain/profile.js";
import {
  useChangePasswordMutation,
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

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editError, setEditError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [feedback, setFeedback] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    setEditOpen(false);
    setPasswordOpen(false);
    setEditError("");
    setPasswordError("");
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
      const result = await changePassword({
        oldPassword,
        newPassword,
        newPasswordConfirmation,
      }).unwrap();
      if (result.token && result.user) {
        const persist = Boolean(window.localStorage?.getItem("jwt"));
        authenticate({ ...session, token: result.token, user: result.user }, undefined, persist);
      }
      setPasswordOpen(false);
      resetPassword();
      showFeedback(t("auth:password.success"));
    } catch (mutationError) {
      setPasswordError(getApiError(mutationError, t("auth:password.loadError")));
    }
  };

  if (isLoading) return <LoadingState label={t("auth:profile.loading")} />;
  if (isError && !user) return <ErrorState message={getApiError(error, t("auth:profile.loadError"))} busy={isFetching} onAction={refetch} />;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      {isError ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={getApiError(error, t("auth:profile.loadError"))} busy={isFetching} onAction={refetch} />
        </div>
      ) : null}
      <Card>
        <ProfileSummaryCard
          user={user}
          isOwner={isOwner}
          onEdit={openEdit}
          onChangePassword={openPasswordDialog}
        />
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

      <FeedbackSnackbar
        open={feedback.open}
        message={feedback.message}
        severity={feedback.severity}
        onClose={() => setFeedback((current) => ({ ...current, open: false }))}
      />
    </div>
  );
};

export default UserProfile;

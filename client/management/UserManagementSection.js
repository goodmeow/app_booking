import React, { useMemo, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AddIconModule from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import LocalizedDataGrid from "../components/common/LocalizedDataGrid.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { isAuthenticated } from "../auth/auth-helper.js";
import { getApiError } from "../domain/api-error.js";
import { ROLE_OPTIONS } from "../domain/roles.js";
import { hasFloor } from "./user-form.js";
import { primaryCardNumber } from "./users/user-cards.js";
import { filterUsers, ROLE_FILTER_ALL } from "./users/user-filters.js";
import UserFormDialog from "./users/UserFormDialog.js";
import UserCardsDialog from "./users/UserCardsDialog.js";
import UserImportDialog from "./users/UserImportDialog.js";
import { buildUserColumns } from "./users/user-columns.js";
import { useUserFormDialog } from "./users/use-user-form-dialog.js";
import { useUserCardsDialog } from "./users/use-user-cards-dialog.js";
import {
  useChangePasswordMutation,
  useDeleteUserMutation,
  useListUserQuery,
  useUpdateUserMutation,
} from "../redux/services/users.js";
import { useGetRoomsQuery } from "../redux/services/rooms.js";

const AddIcon = resolveMuiIcon(AddIconModule);

const UserManagementSection = () => {
  const { t } = useTranslation(["management", "common", "auth"]);
  const { data, isLoading, isFetching, isError, error, refetch } = useListUserQuery();
  const users = Array.isArray(data) ? data : [];
  const roomsQuery = useGetRoomsQuery();
  // Floor group options come from the floors of existing rooms.
  const floorOptions = useMemo(() => {
    const seen = new Set();
    for (const room of roomsQuery.data || []) {
      const floor = String(room.floor ?? "").trim();
      if (floor) seen.add(floor);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [roomsQuery.data]);

  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [feedback, setFeedback] = useState({ open: false, message: "", severity: "success" });
  const [onlyMissingFloor, setOnlyMissingFloor] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(ROLE_FILTER_ALL);
  const [importOpen, setImportOpen] = useState(false);

  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [changePassword, { isLoading: isChangingPassword, reset: resetPassword }] = useChangePasswordMutation();
  const [deleteUser, { isLoading: isDeleting, reset: resetDelete }] = useDeleteUserMutation();
  const session = isAuthenticated();

  const showFeedback = (message, severity = "success") => {
    setFeedback({ open: true, message, severity });
  };

  const formDialog = useUserFormDialog({ t, onSaved: showFeedback });
  const cardsDialog = useUserCardsDialog({ t });

  const openPasswordDialog = (user) => {
    resetPassword();
    setPasswordError("");
    setPasswordUser(user);
  };

  const closePasswordDialog = () => {
    if (isChangingPassword) return;
    setPasswordUser(null);
    setPasswordError("");
    resetPassword();
  };

  const openDeleteDialog = (user) => {
    resetDelete();
    setDeleteError("");
    setDeleteUserTarget(user);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) return;
    setDeleteUserTarget(null);
    setDeleteError("");
    resetDelete();
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
      await updateUser({
        userId: row._id,
        card_number: primaryCardNumber(row),
        master_card: enabled,
      }).unwrap();
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

  const toggleMissingFloorFilter = () => {
    setOnlyMissingFloor((value) => !value);
  };

  const missingFloorCount = useMemo(() => users.filter((user) => !hasFloor(user)).length, [users]);
  const visibleUsers = useMemo(
    () => filterUsers(users, { search, roleId: roleFilter, onlyMissingFloor }),
    [users, search, roleFilter, onlyMissingFloor]
  );

  const columns = useMemo(() => buildUserColumns({
    t,
    floorOptions,
    floorLabel,
    isUpdating,
    changeFloor,
    toggleMasterCard,
    openEdit: formDialog.openEdit,
    openCards: cardsDialog.openCards,
    openPasswordDialog,
    openDeleteDialog,
  }), [t, floorOptions, isUpdating, resetDelete, resetPassword]);

  const hasLoadedUsers = !isLoading && (!isError || users.length > 0);

  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2">{t("users.title")}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setImportOpen(true)}>{t("users.importButton")}</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={formDialog.openCreate}>{t("users.add")}</Button>
        </Stack>
      </Stack>

      {isFetching && !isLoading && users.length > 0 ? <Alert severity="info" sx={{ mb: 1 }}>{t("common:states.refreshing")}</Alert> : null}
      {isLoading ? <LoadingState label={t("users.loading")} /> : null}
      {isError ? <ErrorState message={getApiError(error, t("users.loadError"))} busy={isFetching} onAction={refetch} /> : null}
      {!isLoading && (!isError || users.length > 0) && users.length === 0 ? <EmptyState message={t("users.empty")} /> : null}
      {missingFloorCount > 0 ? (
        <Alert
          severity="warning"
          sx={{ mb: 1.5 }}
          action={(
            <Button color="inherit" size="small" onClick={toggleMissingFloorFilter}>
              {onlyMissingFloor ? t("users.floorShowAll") : t("users.floorShowMissing")}
            </Button>
          )}
        >
          {t("users.floorMissingNotice", { count: missingFloorCount })}
        </Alert>
      ) : null}
      {hasLoadedUsers && users.length > 0 ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 1.5 }}
        >
          <TextField
            size="small"
            fullWidth
            value={search}
            placeholder={t("users.searchPlaceholder")}
            inputProps={{ "aria-label": t("users.searchLabel") }}
            onChange={(event) => setSearch(event.target.value)}
          />
          <TextField
            select
            size="small"
            label={t("users.roleFilter")}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 190 } }}
          >
            <MenuItem value={ROLE_FILTER_ALL}>{t("users.roleAll")}</MenuItem>
            {ROLE_OPTIONS.map((role) => (
              <MenuItem key={role.value} value={role.value}>
                {t(`common:${role.labelKey}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      ) : null}
      {hasLoadedUsers && users.length > 0 ? (
        <LocalizedDataGrid
          rows={visibleUsers}
          columns={columns}
          getRowId={(row) => row._id}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          density="compact"
          disableRowSelectionOnClick
          // Fill the tablet screen instead of hugging the row count.
          sx={{ height: "calc(100vh - 280px)", minHeight: 420 }}
        />
      ) : null}

      <UserFormDialog
        open={Boolean(formDialog.formMode)}
        mode={formDialog.formMode}
        form={formDialog.form}
        setForm={formDialog.setForm}
        formError={formDialog.formError}
        detailError={formDialog.detailError}
        isDetailLoading={formDialog.isDetailLoading}
        isSaving={formDialog.isSaving}
        floorOptions={floorOptions}
        onClose={formDialog.closeForm}
        onSubmit={formDialog.submitForm}
        t={t}
      />

      <UserCardsDialog
        open={Boolean(cardsDialog.targetUser)}
        userName={cardsDialog.targetUser?.name || ""}
        cards={cardsDialog.cards}
        activeCount={cardsDialog.activeCount}
        limitReached={cardsDialog.limitReached}
        cardNumber={cardsDialog.cardNumber}
        setCardNumber={cardsDialog.setCardNumber}
        formError={cardsDialog.formError}
        isAdding={cardsDialog.isAdding}
        isMarkingLost={cardsDialog.isMarkingLost}
        isReactivating={cardsDialog.isReactivating}
        onClose={cardsDialog.close}
        onAddCard={cardsDialog.submitCard}
        onMarkLost={cardsDialog.markLost}
        onReactivate={cardsDialog.reactivate}
        t={t}
      />

      <UserImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          refetch();
          showFeedback(t("users.imported"));
        }}
      />

      <PasswordDialog
        open={Boolean(passwordUser)}
        requireOldPassword={passwordUser?._id === session?.user?._id}
        loading={isChangingPassword}
        error={passwordError}
        onClose={closePasswordDialog}
        onSubmit={submitPassword}
      />

      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        title={t("users.deleteTitle")}
        message={deleteError || t("users.deleteMessage", { name: deleteUserTarget?.name || "" })}
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
    </Box>
  );
};

export default UserManagementSection;

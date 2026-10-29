import React, { useMemo, useState } from "react";
import { Alert, Button, Card, Grid, Input, Select, Space, Table, Tag, Typography } from "antd";
import { ClearOutlined, PlusOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { isAuthenticated } from "../auth/auth-helper.js";
import { getApiError } from "../domain/api-error.js";
import { hasFloor } from "./user-form.js";
import { primaryCardNumber } from "./users/user-cards.js";
import { filterUsers, roleLabel, ROLE_FILTER_ALL, ROLE_FILTER_OPTIONS } from "./users/user-filters.js";
import UserFormDialog from "./users/UserFormDialog.js";
import UserCardsDialog from "./users/UserCardsDialog.js";
import UserImportDialog from "./users/UserImportDialog.js";
import { buildUserColumns, UserActions } from "./users/user-columns.js";
import { useUserFormDialog } from "./users/use-user-form-dialog.js";
import { useUserCardsDialog } from "./users/use-user-cards-dialog.js";
import {
  useChangePasswordMutation,
  useDeleteUserMutation,
  useListUserQuery,
} from "../redux/services/users.js";
import { useGetRoomsQuery } from "../redux/services/rooms.js";

const FLOOR_FILTER_ALL = "__all_floors__";
const MASTER_FILTER_ALL = "__all_master__";
const MASTER_FILTER_YES = "yes";
const MASTER_FILTER_NO = "no";

const UserManagementSection = () => {
  const { t } = useTranslation(["management", "common", "auth"]);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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
  const [floorFilter, setFloorFilter] = useState(FLOOR_FILTER_ALL);
  const [masterFilter, setMasterFilter] = useState(MASTER_FILTER_ALL);
  const [importOpen, setImportOpen] = useState(false);

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

  const floorLabel = (value) => {
    const floors = Array.isArray(value) ? value : (value ? [value] : []);
    if (!floors.length) return t("users.floorUnset");
    return floors.map((floor) => (floor === "all" ? t("users.floorAll") : t("users.floorValue", { floor }))).join(", ");
  };

  const toggleMissingFloorFilter = () => {
    setOnlyMissingFloor((value) => !value);
  };

  const missingFloorCount = useMemo(() => users.filter((user) => !hasFloor(user)).length, [users]);
  const visibleUsers = useMemo(() => {
    const base = filterUsers(users, { search, roleId: roleFilter, onlyMissingFloor });
    return base.filter((user) => {
      if (floorFilter !== FLOOR_FILTER_ALL) {
        const floors = user.floors?.length ? user.floors : (user.floor ? [user.floor] : []);
        if (!floors.includes(floorFilter)) return false;
      }
      if (masterFilter === MASTER_FILTER_YES && !user.is_master_card) return false;
      if (masterFilter === MASTER_FILTER_NO && user.is_master_card) return false;
      return true;
    });
  }, [users, search, roleFilter, floorFilter, masterFilter, onlyMissingFloor]);

  const hasFilters = Boolean(search)
    || roleFilter !== ROLE_FILTER_ALL
    || floorFilter !== FLOOR_FILTER_ALL
    || masterFilter !== MASTER_FILTER_ALL
    || onlyMissingFloor;

  const resetFilters = () => {
    setSearch("");
    setRoleFilter(ROLE_FILTER_ALL);
    setFloorFilter(FLOOR_FILTER_ALL);
    setMasterFilter(MASTER_FILTER_ALL);
    setOnlyMissingFloor(false);
  };

  const columns = useMemo(() => buildUserColumns({
    t,
    floorLabel,
    openEdit: formDialog.openEdit,
    openCards: cardsDialog.openCards,
    openPasswordDialog,
    openDeleteDialog,
  }), [t, floorLabel]);

  const roleOptions = [
    { value: ROLE_FILTER_ALL, label: t("users.roleAll") },
    ...ROLE_FILTER_OPTIONS.map((role) => ({
      value: role.value,
      label: t(`common:${role.labelKey}`),
    })),
  ];

  const floorFilterOptions = [
    { value: FLOOR_FILTER_ALL, label: t("users.floorAllFilters") },
    ...floorOptions.map((floor) => ({
      value: floor,
      label: t("users.floorValue", { floor }),
    })),
  ];

  const masterFilterOptions = [
    { value: MASTER_FILTER_ALL, label: t("users.masterAll") },
    { value: MASTER_FILTER_YES, label: t("users.masterYes") },
    { value: MASTER_FILTER_NO, label: t("users.masterNo") },
  ];

  const hasLoadedUsers = !isLoading && (!isError || users.length > 0);

  return (
    <section>
      <Space
        align="center"
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>{t("users.title")}</Typography.Title>
        <Space>
          <Button onClick={() => setImportOpen(true)}>{t("users.importButton")}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={formDialog.openCreate}>
            {t("users.add")}
          </Button>
        </Space>
      </Space>

      {isFetching && !isLoading && users.length > 0 ? (
        <Alert type="info" showIcon message={t("common:states.refreshing")} style={{ marginBottom: 8 }} />
      ) : null}
      {isLoading ? <LoadingState label={t("users.loading")} /> : null}
      {isError ? <ErrorState message={getApiError(error, t("users.loadError"))} busy={isFetching} onAction={refetch} /> : null}
      {!isLoading && (!isError || users.length > 0) && users.length === 0 ? <EmptyState message={t("users.empty")} /> : null}

      {hasLoadedUsers && users.length > 0 ? (
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          {t("users.summary", { count: users.length, missing: missingFloorCount })}
        </Typography.Text>
      ) : null}

      {missingFloorCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("users.floorMissingNotice", { count: missingFloorCount })}
          action={(
            <Button size="small" onClick={toggleMissingFloorFilter}>
              {onlyMissingFloor ? t("users.floorShowAll") : t("users.floorShowMissing")}
            </Button>
          )}
        />
      ) : null}

      {hasLoadedUsers && users.length > 0 ? (
        <Space style={{ width: "100%", marginBottom: 12 }} wrap>
          <Input
            allowClear
            value={search}
            placeholder={t("users.searchPlaceholder")}
            aria-label={t("users.searchLabel")}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 260 }}
          />
          <Select
            value={roleFilter}
            options={roleOptions}
            aria-label={t("users.roleFilter")}
            onChange={(value) => setRoleFilter(value ?? ROLE_FILTER_ALL)}
            style={{ minWidth: 190 }}
          />
          <Select
            value={floorFilter}
            options={floorFilterOptions}
            aria-label={t("users.floorFilter")}
            onChange={(value) => setFloorFilter(value ?? FLOOR_FILTER_ALL)}
            style={{ minWidth: 160 }}
          />
          <Select
            value={masterFilter}
            options={masterFilterOptions}
            aria-label={t("users.masterFilter")}
            onChange={(value) => setMasterFilter(value ?? MASTER_FILTER_ALL)}
            style={{ minWidth: 160 }}
          />
          {hasFilters ? (
            <Button
              size="small"
              icon={<ClearOutlined />}
              aria-label={t("users.roleClear")}
              onClick={resetFilters}
            />
          ) : null}
        </Space>
      ) : null}

      {hasLoadedUsers && users.length > 0 ? (
        isMobile ? (
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            {visibleUsers.length ? visibleUsers.map((row) => {
              const floors = row.floors?.length ? row.floors : (row.floor ? [row.floor] : []);
              const role = roleLabel(t, row.role_id);
              const card = primaryCardNumber(row);
              return (
                <Card key={row._id} size="small">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <div>
                      <Typography.Text strong>{row.name}</Typography.Text>
                      <div>
                        <Typography.Text type="secondary">
                          {[row.email, row.employee_id].filter(Boolean).join(" · ")}
                        </Typography.Text>
                      </div>
                    </div>
                    <Space size={4} wrap>
                      {role ? <Tag color="green">{role}</Tag> : null}
                      {floors.length
                        ? floors.map((floor) => (
                          <Tag key={floor} color={floor === "all" ? "green" : undefined}>
                            {floorLabel(floor)}
                          </Tag>
                        ))
                        : <Tag color="warning">{t("users.floorUnset")}</Tag>}
                    </Space>
                    <Space size={8} wrap style={{ width: "100%", justifyContent: "space-between" }}>
                      <Space size={4} wrap>
                        <Typography.Text type="secondary">
                          {card || t("users.cardMissing")}
                        </Typography.Text>
                        {row.is_master_card ? <Tag color="gold">{t("users.masterCard")}</Tag> : null}
                      </Space>
                      <UserActions
                        row={row}
                        t={t}
                        openEdit={formDialog.openEdit}
                        openCards={cardsDialog.openCards}
                        openPasswordDialog={openPasswordDialog}
                        openDeleteDialog={openDeleteDialog}
                      />
                    </Space>
                  </Space>
                </Card>
              );
            }) : <EmptyState message={t("users.empty")} />}
          </Space>
        ) : (
          <Table
            rowKey="_id"
            size="small"
            columns={columns}
            dataSource={visibleUsers}
            loading={isFetching}
            locale={{ emptyText: t("users.empty") }}
            pagination={{
              defaultPageSize: 25,
              showSizeChanger: true,
              pageSizeOptions: [25, 50, 100],
            }}
            scroll={{ x: 1000, y: "calc(100vh - 420px)" }}
          />
        )
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
        isProtectedAccount={formDialog.isProtectedAccount}
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
    </section>
  );
};

export default UserManagementSection;

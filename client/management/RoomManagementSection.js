import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Space, Table, Typography } from "antd";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import {
  useDeleteRoomByIdMutation,
  useGetRoomByIdQuery,
  useGetRoomsQuery,
  useStoreRoomMutation,
  useUpdateRoomMutation,
} from "../redux/services/rooms.js";
import { useChangePasswordMutation } from "../redux/services/users.js";
import { useGetKioskDevicesQuery } from "../redux/services/kiosk-devices.js";
import RoomFormDialog from "./rooms/RoomFormDialog.js";
import { buildRoomColumns, devicesByRoom } from "./rooms/room-columns.js";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  floor: "",
  building: "",
  capacity: "",
  feature: "",
};

const RoomManagementSection = () => {
  const { t } = useTranslation(["management", "common"]);
  const rooms = useGetRoomsQuery();
  const devicesQuery = useGetKioskDevicesQuery(undefined, { pollingInterval: 15000 });
  const deviceByRoom = useMemo(() => devicesByRoom(devicesQuery.data), [devicesQuery.data]);
  const [storeRoom, storeState] = useStoreRoomMutation();
  const [updateRoom, updateState] = useUpdateRoomMutation();
  const [deleteRoom, deleteState] = useDeleteRoomByIdMutation();
  const [changePassword, passwordState] = useChangePasswordMutation();
  const [dialog, setDialog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const roomDetail = useGetRoomByIdQuery(selected?._id, { skip: dialog !== "edit" || !selected?._id });

  useEffect(() => {
    if (dialog !== "edit" || !roomDetail.data) return;
    const room = roomDetail.data;
    setForm({
      name: room.name || "",
      email: room.email || "",
      password: "",
      floor: room.floor || "",
      building: room.building || "",
      capacity: room.capacity || "",
      feature: room.feature || "",
    });
  }, [dialog, roomDetail.data]);

  const close = () => {
    setDialog(null);
    setSelected(null);
    setForm(emptyForm);
    setError("");
    setDeleteError("");
  };

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setDialog("create");
  };

  const openEdit = (room) => {
    setSelected(room);
    setForm(emptyForm);
    setError("");
    setDialog("edit");
  };

  const openPasswordDialog = (room) => {
    setSelected(room);
    setError("");
    setDialog("password");
  };

  const openDeleteDialog = (room) => {
    setSelected(room);
    setDeleteError("");
    setDialog("delete");
  };

  const submitRoom = async (event) => {
    event.preventDefault();
    setError("");
    const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
    if (!body.name || !body.email || (dialog === "create" && !body.password)) {
      setError(t("rooms.required"));
      return;
    }
    try {
      if (dialog === "create") await storeRoom(body).unwrap();
      else {
        const { password, ...updateBody } = body;
        await updateRoom({ roomId: selected._id, ...updateBody }).unwrap();
      }
      close();
    } catch (reason) {
      setError(getApiError(reason, t("common:states.error")));
    }
  };

  const submitPassword = async ({ newPassword, newPasswordConfirmation }) => {
    setError("");
    if (newPassword !== newPasswordConfirmation) {
      setError(t("rooms.passwordMismatch"));
      return;
    }
    try {
      await changePassword({ userId: selected._id, newPassword, newPasswordConfirmation }).unwrap();
      close();
    } catch (reason) {
      setError(getApiError(reason, t("common:states.error")));
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteRoom(selected._id).unwrap();
      close();
    } catch (reason) {
      setDeleteError(getApiError(reason, t("common:states.error")));
    }
  };

  const columns = buildRoomColumns({
    t,
    deviceByRoom,
    openEdit,
    openPasswordDialog,
    openDeleteDialog,
  });

  if (rooms.isLoading) return <LoadingState label={t("rooms.loading")} />;
  const hasRoomRows = Array.isArray(rooms.data) && rooms.data.length > 0;
  if (rooms.isError && !hasRoomRows) return <ErrorState message={getApiError(rooms.error, t("rooms.loadError"))} busy={rooms.isFetching} onAction={rooms.refetch} />;

  const isEditing = dialog === "edit";

  return (
    <section>
      <Space
        align="center"
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>{t("rooms.title")}</Typography.Title>
        <Button type="primary" onClick={openCreate}>{t("rooms.add")}</Button>
      </Space>
      {rooms.isFetching ? (
        <Alert type="info" showIcon message={t("common:states.refreshing")} style={{ marginBottom: 8 }} />
      ) : null}
      {rooms.isError ? (
        <ErrorState message={getApiError(rooms.error, t("rooms.loadError"))} busy={rooms.isFetching} onAction={rooms.refetch} />
      ) : null}
      <Table
        size="small"
        rowKey="_id"
        columns={columns}
        dataSource={rooms.data || []}
        loading={rooms.isFetching}
        pagination={{ pageSize: 5, showSizeChanger: false }}
        scroll={{ x: 1000 }}
      />

      <RoomFormDialog
        open={dialog === "create" || isEditing}
        mode={dialog}
        form={form}
        setForm={setForm}
        error={error}
        detailError={isEditing && roomDetail.isError ? roomDetail.error : null}
        isDetailLoading={roomDetail.isFetching}
        isSaving={storeState.isLoading || updateState.isLoading}
        submitDisabled={isEditing && (roomDetail.isError || !roomDetail.data)}
        onClose={close}
        onSubmit={submitRoom}
        t={t}
      />

      <PasswordDialog
        open={dialog === "password"}
        requireOldPassword={false}
        loading={passwordState.isLoading}
        error={dialog === "password" ? error : ""}
        onClose={close}
        onSubmit={submitPassword}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        title={t("common:dialogs.confirmDelete")}
        message={deleteError || t("rooms.deleteMessage", { name: selected?.name || "" })}
        loading={deleteState.isLoading}
        onCancel={close}
        onConfirm={confirmDelete}
      />
    </section>
  );
};

export default RoomManagementSection;

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FormDialog from "../components/common/FormDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import LocalizedDataGrid from "../components/common/LocalizedDataGrid.js";
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
  const deviceByRoom = useMemo(() => {
    const map = new Map();
    (devicesQuery.data || []).forEach((device) => map.set(String(device.roomId), device));
    return map;
  }, [devicesQuery.data]);
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

  const change = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));

  const submit = async (event) => {
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

  const columns = [
    { field: "name", headerName: t("common:fields.name"), minWidth: 140, flex: 1 },
    { field: "building", headerName: t("rooms.building"), minWidth: 120, flex: 0.7 },
    { field: "capacity", headerName: t("rooms.capacity"), minWidth: 100, flex: 0.6 },
    { field: "floor", headerName: t("rooms.floor"), minWidth: 90, flex: 0.5 },
    { field: "email", headerName: t("common:fields.email"), minWidth: 190, flex: 1 },
    {
      field: "tablet",
      headerName: t("rooms.tablet"),
      minWidth: 140,
      flex: 0.7,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => {
        const device = deviceByRoom.get(String(row._id));
        if (!device) return <Chip size="small" label={t("rooms.tabletNone")} />;
        if (device.status === "revoked") return <Chip size="small" color="error" label={t("rooms.tabletRevoked")} />;
        return device.online
          ? <Chip size="small" color="success" label={t("rooms.tabletOnline")} />
          : <Chip size="small" color="default" label={t("rooms.tabletOffline")} />;
      },
    },
    {
      field: "actions",
      headerName: t("common:fields.action"),
      sortable: false,
      filterable: false,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={() => openEdit(row)}>{t("common:actions.edit")}</Button>
          <Button size="small" onClick={() => { setSelected(row); setError(""); setDialog("password"); }}>{t("common:actions.changePassword")}</Button>
          <Button size="small" color="error" onClick={() => { setSelected(row); setDeleteError(""); setDialog("delete"); }}>{t("common:actions.delete")}</Button>
        </Stack>
      ),
    },
  ];

  if (rooms.isLoading) return <LoadingState label={t("rooms.loading")} />;
  const hasRoomRows = Array.isArray(rooms.data) && rooms.data.length > 0;
  if (rooms.isError && !hasRoomRows) return <ErrorState message={getApiError(rooms.error, t("rooms.loadError"))} busy={rooms.isFetching} onAction={rooms.refetch} />;

  return (
    <Box component="section">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{t("rooms.title")}</Typography>
        <Button variant="contained" onClick={openCreate}>{t("rooms.add")}</Button>
      </Stack>
      {rooms.isFetching ? <Alert severity="info" sx={{ mb: 1 }}>{t("common:states.refreshing")}</Alert> : null}
      {rooms.isError ? <ErrorState message={getApiError(rooms.error, t("rooms.loadError"))} busy={rooms.isFetching} onAction={rooms.refetch} /> : null}
      <LocalizedDataGrid
        autoHeight
        rows={rooms.data || []}
        columns={columns}
        getRowId={(row) => row._id}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
        pageSizeOptions={[5]}
        density="compact"
        disableRowSelectionOnClick
      />

      <FormDialog
        open={dialog === "create" || dialog === "edit"}
        title={dialog === "create" ? t("rooms.createTitle") : t("rooms.editTitle")}
        formId="room-form"
        loading={storeState.isLoading || updateState.isLoading || (dialog === "edit" && roomDetail.isFetching)}
        submitDisabled={dialog === "edit" && (roomDetail.isError || !roomDetail.data)}
        onClose={close}
        onSubmit={submit}
      >
        {dialog === "edit" && roomDetail.isFetching ? <LoadingState label={t("rooms.loadingOne")} /> : (
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {dialog === "edit" && roomDetail.isError && <Alert severity="error">{getApiError(roomDetail.error, t("rooms.loadOneError"))}</Alert>}
          <TextField required label={t("common:fields.name")} value={form.name} onChange={change("name")} />
          <TextField required type="email" label={t("common:fields.email")} value={form.email} onChange={change("email")} />
          {dialog === "create" && <TextField required type="password" label={t("common:fields.password")} value={form.password} onChange={change("password")} />}
          <TextField label={t("rooms.floor")} value={form.floor} onChange={change("floor")} />
          <TextField label={t("rooms.building")} value={form.building} onChange={change("building")} />
          <TextField label={t("rooms.capacity")} value={form.capacity} onChange={change("capacity")} />
          <TextField label={t("rooms.feature")} value={form.feature} onChange={change("feature")} />
        </Stack>
        )}
      </FormDialog>

      <PasswordDialog
        open={dialog === "password"}
        requireOldPassword={false}
        loading={passwordState.isLoading}
        error={dialog === "password" ? error : ""}
        onClose={close}
        onSubmit={async ({ newPassword, newPasswordConfirmation }) => {
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
        }}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        title={t("common:dialogs.confirmDelete")}
        message={deleteError || t("rooms.deleteMessage", { name: selected?.name || "" })}
        loading={deleteState.isLoading}
        onCancel={close}
        onConfirm={async () => {
          try {
            await deleteRoom(selected._id).unwrap();
            close();
          } catch (reason) {
            setDeleteError(getApiError(reason, t("common:states.error")));
          }
        }}
      />
    </Box>
  );
};

export default RoomManagementSection;

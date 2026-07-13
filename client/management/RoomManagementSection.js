import React, { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FormDialog from "../components/common/FormDialog.js";
import PasswordDialog from "../components/common/PasswordDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { ROLE_IDS, ROLE_OPTIONS } from "../domain/roles.js";
import {
  useDeleteRoomByIdMutation,
  useGetRoomByIdQuery,
  useGetRoomsQuery,
  useStoreRoomMutation,
  useUpdateRoomMutation,
} from "../redux/services/rooms.js";
import { useChangePasswordMutation } from "../redux/services/users.js";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  floor: "",
  building: "",
  capacity: "",
  feature: "",
  roleId: "",
};

const RoomManagementSection = () => {
  const rooms = useGetRoomsQuery();
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
      roleId: room.role_id || ROLE_IDS.USER,
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
    if (!body.name || !body.email || (dialog === "create" && !body.password) || !body.roleId) {
      setError("Some required field is missing");
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
      setError(getApiError(reason));
    }
  };

  const columns = [
    { field: "_id", headerName: "Room ID", minWidth: 210, flex: 1 },
    { field: "name", headerName: "Name", minWidth: 150, flex: 1 },
    { field: "building", headerName: "Building", minWidth: 120, flex: 0.7 },
    { field: "capacity", headerName: "Capacity", minWidth: 100, flex: 0.6 },
    { field: "floor", headerName: "Floor", minWidth: 90, flex: 0.5 },
    { field: "email", headerName: "Email", minWidth: 210, flex: 1 },
    {
      field: "actions",
      headerName: "Action",
      sortable: false,
      filterable: false,
      minWidth: 250,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="small" onClick={() => { setSelected(row); setError(""); setDialog("password"); }}>Password</Button>
          <Button size="small" color="error" onClick={() => { setSelected(row); setDeleteError(""); setDialog("delete"); }}>Delete</Button>
        </Stack>
      ),
    },
  ];

  if (rooms.isLoading) return <LoadingState />;
  if (rooms.isError) return <ErrorState message={getApiError(rooms.error, "Unable to load rooms")} />;

  return (
    <Box component="section">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">All Rooms</Typography>
        <Button variant="contained" onClick={openCreate}>Add New Room</Button>
      </Stack>
      <DataGrid
        autoHeight
        rows={rooms.data || []}
        columns={columns}
        getRowId={(row) => row._id}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
        pageSizeOptions={[5]}
        disableRowSelectionOnClick
      />

      <FormDialog
        open={dialog === "create" || dialog === "edit"}
        title={dialog === "create" ? "Create New Room" : "Edit Room"}
        formId="room-form"
        loading={storeState.isLoading || updateState.isLoading || (dialog === "edit" && roomDetail.isFetching)}
        submitDisabled={dialog === "edit" && (roomDetail.isError || !roomDetail.data)}
        onClose={close}
        onSubmit={submit}
      >
        {dialog === "edit" && roomDetail.isFetching ? <LoadingState label="Loading room..." /> : (
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {dialog === "edit" && roomDetail.isError && <Alert severity="error">{getApiError(roomDetail.error, "Unable to load room")}</Alert>}
          <TextField required label="Name" value={form.name} onChange={change("name")} />
          <TextField required type="email" label="Email" value={form.email} onChange={change("email")} />
          {dialog === "create" && <TextField required type="password" label="Password" value={form.password} onChange={change("password")} />}
          <TextField label="Floor" value={form.floor} onChange={change("floor")} />
          <TextField label="Building" value={form.building} onChange={change("building")} />
          <TextField label="Capacity" value={form.capacity} onChange={change("capacity")} />
          <TextField label="Feature" value={form.feature} onChange={change("feature")} />
          {dialog === "create" && (
            <TextField select required label="Role" value={form.roleId} onChange={change("roleId")}>
              {ROLE_OPTIONS.map((role) => <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>)}
            </TextField>
          )}
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
            setError("New password and confirmation password mismatch");
            return;
          }
          try {
            await changePassword({ userId: selected._id, newPassword, newPasswordConfirmation }).unwrap();
            close();
          } catch (reason) {
            setError(getApiError(reason));
          }
        }}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        message={deleteError || `Delete room ${selected?.name || ""}?`}
        loading={deleteState.isLoading}
        onCancel={close}
        onConfirm={async () => {
          try {
            await deleteRoom(selected._id).unwrap();
            close();
          } catch (reason) {
            setDeleteError(getApiError(reason));
          }
        }}
      />
    </Box>
  );
};

export default RoomManagementSection;

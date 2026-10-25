import React from "react";
import { Chip, IconButton, Stack, Tooltip } from "@mui/material";
import DeleteIconModule from "@mui/icons-material/Delete";
import EditIconModule from "@mui/icons-material/Edit";
import PasswordIconModule from "@mui/icons-material/Password";
import { resolveMuiIcon } from "../../components/common/resolve-mui-icon.js";

const DeleteIcon = resolveMuiIcon(DeleteIconModule);
const EditIcon = resolveMuiIcon(EditIconModule);
const PasswordIcon = resolveMuiIcon(PasswordIconModule);

const tabletChip = (device, t) => {
  if (!device) return <Chip size="small" label={t("rooms.tabletNone")} />;
  if (device.status === "revoked") return <Chip size="small" color="error" label={t("rooms.tabletRevoked")} />;
  return device.online
    ? <Chip size="small" color="success" label={t("rooms.tabletOnline")} />
    : <Chip size="small" color="default" label={t("rooms.tabletOffline")} />;
};

// Column definitions for the Rooms grid. `deviceByRoom` maps a room id to its
// paired tablet, so the tablet column stays a pure lookup.
export const buildRoomColumns = ({
  t,
  deviceByRoom,
  openEdit,
  openPasswordDialog,
  openDeleteDialog,
}) => [
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
    renderCell: ({ row }) => tabletChip(deviceByRoom.get(String(row._id)), t),
  },
  {
    field: "actions",
    headerName: t("common:fields.action"),
    sortable: false,
    filterable: false,
    // Three icon buttons like the Users tab: text buttons get clipped at 1440 px wide.
    width: 150,
    renderCell: ({ row }) => (
      <Stack direction="row" spacing={0.25}>
        <Tooltip title={t("common:actions.edit")}>
          <IconButton size="small" aria-label={`${t("common:actions.edit")} ${row.name}`} onClick={() => openEdit(row)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("common:actions.changePassword")}>
          <IconButton size="small" aria-label={`${t("common:actions.changePassword")} ${row.name}`} onClick={() => openPasswordDialog(row)}>
            <PasswordIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("common:actions.delete")}>
          <IconButton size="small" color="error" aria-label={`${t("common:actions.delete")} ${row.name}`} onClick={() => openDeleteDialog(row)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    ),
  },
];

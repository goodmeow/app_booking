import React, { useState } from "react";
import { Alert, Box, Button, Chip, Stack, Switch, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import {
  useGetKioskDevicesQuery,
  useRevokeKioskDeviceMutation,
  useUpdateKioskDeviceCapabilitiesMutation,
} from "../redux/services/kiosk-devices.js";

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Never";

const KioskDeviceManagementSection = () => {
  const { data: devices = [], error: queryError, isLoading } = useGetKioskDevicesQuery();
  const [revokeDevice, { isLoading: isRevoking }] = useRevokeKioskDeviceMutation();
  const [updateCapabilities, { isLoading: isUpdatingCapabilities }] = useUpdateKioskDeviceCapabilitiesMutation();
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeError, setRevokeError] = useState("");
  const [capabilityError, setCapabilityError] = useState("");

  const toggleCapability = async (deviceId, capability, enabled) => {
    setCapabilityError("");
    try {
      await updateCapabilities({ deviceId, [capability]: enabled }).unwrap();
    } catch (error) {
      setCapabilityError(getApiError(error, "Failed to update kiosk capability"));
    }
  };

  const closeRevoke = () => {
    if (isRevoking) return;
    setRevokeTarget(null);
    setRevokeError("");
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevokeError("");
    try {
      await revokeDevice(revokeTarget.id).unwrap();
      setRevokeTarget(null);
    } catch (error) {
      setRevokeError(getApiError(error, "Failed to revoke kiosk device"));
    }
  };

  const columns = [
    { field: "name", headerName: "Device", minWidth: 180, flex: 1 },
    {
      field: "roomName",
      headerName: "Room",
      minWidth: 220,
      flex: 1,
      valueGetter: ({ row }) => row.roomName || row.roomEmail || "Unknown room",
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 110,
      renderCell: ({ value }) => (
        <Chip
          size="small"
          label={String(value || "unknown").toUpperCase()}
          color={value === "active" ? "success" : "default"}
        />
      ),
    },
    {
      field: "nfcEnabled",
      headerName: "NFC",
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <Switch
          checked={Boolean(row.nfcEnabled)}
          disabled={row.status !== "active" || isUpdatingCapabilities}
          inputProps={{ "aria-label": `NFC for ${row.name}` }}
          onChange={(event) => void toggleCapability(row.id, "nfcEnabled", event.target.checked)}
        />
      ),
    },
    {
      field: "ledEnabled",
      headerName: "LED",
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <Switch
          checked={Boolean(row.ledEnabled)}
          disabled={row.status !== "active" || isUpdatingCapabilities}
          inputProps={{ "aria-label": `LED for ${row.name}` }}
          onChange={(event) => void toggleCapability(row.id, "ledEnabled", event.target.checked)}
        />
      ),
    },
    {
      field: "lastSeenAt",
      headerName: "Last Seen",
      minWidth: 190,
      flex: 0.8,
      valueFormatter: ({ value }) => formatDateTime(value),
    },
    {
      field: "createdAt",
      headerName: "Provisioned",
      minWidth: 190,
      flex: 0.8,
      valueFormatter: ({ value }) => formatDateTime(value),
    },
    {
      field: "actions",
      headerName: "Action",
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => row.status === "active" ? (
        <Button
          color="error"
          size="small"
          onClick={() => { setRevokeError(""); setRevokeTarget(row); }}
          aria-label={`Revoke kiosk ${row.name}`}
        >
          Revoke
        </Button>
      ) : null,
    },
  ];

  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Kiosk Devices</Typography>
          <Typography color="text.secondary">Provisioned room displays and access status.</Typography>
        </Box>
      </Stack>

      {isLoading && <LoadingState label="Loading kiosk devices..." />}
      {queryError && !isLoading && (
        <ErrorState message={getApiError(queryError, "Failed to load kiosk devices")} />
      )}
      {capabilityError ? <Alert severity="error" sx={{ mb: 2 }}>{capabilityError}</Alert> : null}
      {!isLoading && !queryError && (
        <DataGrid
          autoHeight
          rows={devices}
          columns={columns}
          getRowId={(row) => row.id}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
          pageSizeOptions={[5]}
          disableRowSelectionOnClick
        />
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke Kiosk Device"
        message={revokeError || `Revoke ${revokeTarget?.name || "this kiosk"}? The tablet must be provisioned again.`}
        loading={isRevoking}
        onCancel={closeRevoke}
        onConfirm={confirmRevoke}
      />
    </Box>
  );
};

export default KioskDeviceManagementSection;

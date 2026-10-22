import React, { useState } from "react";
import { Alert, Box, Button, Chip, Stack, Switch, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import LocalizedDataGrid from "../components/common/LocalizedDataGrid.js";
import { getApiError } from "../domain/api-error.js";
import { localeForLanguage } from "../i18n/languages.js";
import {
  useGetKioskDevicesQuery,
  useRevokeKioskDeviceMutation,
  useUpdateKioskDeviceCapabilitiesMutation,
} from "../redux/services/kiosk-devices.js";

const formatDateTime = (value, language, neverLabel) => value
  ? new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : neverLabel;

const KioskDeviceManagementSection = () => {
  const { t, i18n } = useTranslation(["management", "common"]);
  const { data: devices = [], error: queryError, isLoading, isFetching, refetch } = useGetKioskDevicesQuery(undefined, { pollingInterval: 15000 });
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
      setCapabilityError(getApiError(error, t("devices.capabilityError")));
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
      setRevokeError(getApiError(error, t("devices.revokeError")));
    }
  };

  const columns = [
    { field: "name", headerName: t("devices.device"), minWidth: 180, flex: 1 },
    {
      field: "roomName",
      headerName: t("devices.room"),
      minWidth: 220,
      flex: 1,
      valueGetter: ({ row }) => row.roomName || row.roomEmail || t("devices.unknownRoom"),
    },
    {
      field: "status",
      headerName: t("common:fields.status"),
      minWidth: 110,
      renderCell: ({ row }) => {
        if (row.status === "revoked") return <Chip size="small" color="error" label={t("devices.status.revoked")} />;
        if (row.status === "expired") return <Chip size="small" color="warning" label={t("devices.status.expired")} />;
        return row.online
          ? <Chip size="small" color="success" label={t("devices.status.online")} />
          : <Chip size="small" label={t("devices.status.offline")} />;
      },
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
          inputProps={{ "aria-label": t("devices.nfcAria", { name: row.name }) }}
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
          inputProps={{ "aria-label": t("devices.ledAria", { name: row.name }) }}
          onChange={(event) => void toggleCapability(row.id, "ledEnabled", event.target.checked)}
        />
      ),
    },
    {
      field: "lastSeenAt",
      headerName: t("devices.lastSeen"),
      minWidth: 190,
      flex: 0.8,
      valueFormatter: ({ value }) => formatDateTime(value, i18n.resolvedLanguage || "en", t("common:states.never")),
    },
    {
      field: "createdAt",
      headerName: t("devices.provisioned"),
      minWidth: 190,
      flex: 0.8,
      valueFormatter: ({ value }) => formatDateTime(value, i18n.resolvedLanguage || "en", t("common:states.never")),
    },
    {
      field: "actions",
      headerName: t("common:fields.action"),
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => row.status === "active" ? (
        <Button
          color="error"
          size="small"
          onClick={() => { setRevokeError(""); setRevokeTarget(row); }}
          aria-label={t("devices.revokeAria", { name: row.name })}
        >
          {t("devices.revoke")}
        </Button>
      ) : null,
    },
  ];

  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{t("devices.title")}</Typography>
          <Typography color="text.secondary">{t("devices.description")}</Typography>
        </Box>
      </Stack>

      {isFetching && !isLoading ? <Alert severity="info" sx={{ mb: 1 }}>{t("common:states.refreshing")}</Alert> : null}
      {isLoading && <LoadingState label={t("devices.loading")} />}
      {queryError && !isLoading && !devices.length && (
        <ErrorState message={getApiError(queryError, t("devices.loadError"))} busy={isFetching} onAction={refetch} />
      )}
      {queryError && !isLoading && devices.length ? (
        <ErrorState message={getApiError(queryError, t("devices.loadError"))} busy={isFetching} onAction={refetch} />
      ) : null}
      {capabilityError ? <Alert severity="error" sx={{ mb: 2 }}>{capabilityError}</Alert> : null}
      {!isLoading && (!queryError || devices.length > 0) && (
        <LocalizedDataGrid
          autoHeight
          rows={devices}
          columns={columns}
          getRowId={(row) => row.id}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
          pageSizeOptions={[5]}
          density="compact"
          disableRowSelectionOnClick
        />
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t("devices.revokeTitle")}
        message={revokeError || t("devices.revokeMessage", { name: revokeTarget?.name || t("devices.device") })}
        loading={isRevoking}
        onCancel={closeRevoke}
        onConfirm={confirmRevoke}
      />
    </Box>
  );
};

export default KioskDeviceManagementSection;

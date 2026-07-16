import React, { useState } from "react";
import DeleteOutlineIconModule from "@mui/icons-material/DeleteOutline";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FormDialog from "../components/common/FormDialog.js";
import LocalizedDataGrid from "../components/common/LocalizedDataGrid.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { getApiError } from "../domain/api-error.js";
import {
  useDeleteCardMasterMutation,
  useGetCardMasterQuery,
  useStoreCardMasterMutation,
} from "../redux/services/settings.js";

const DeleteOutlineIcon = resolveMuiIcon(DeleteOutlineIconModule);

const CardMasterSection = () => {
  const { t } = useTranslation(["management", "common"]);
  const { data: cards = [], error: queryError, isLoading, isFetching, refetch } = useGetCardMasterQuery();
  const [storeCardMaster, { isLoading: isCreating }] = useStoreCardMasterMutation();
  const [deleteCardMaster, { isLoading: isDeleting }] = useDeleteCardMasterMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [createError, setCreateError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const openCreate = () => {
    setCardNumber("");
    setCreateError("");
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (isCreating) return;
    setCreateOpen(false);
    setCardNumber("");
    setCreateError("");
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    setCreateError("");
    const normalizedCardNumber = cardNumber.trim();
    if (!normalizedCardNumber) {
      setCreateError(t("cards.required"));
      return;
    }
    try {
      await storeCardMaster({ card_number: normalizedCardNumber }).unwrap();
      setCreateOpen(false);
      setCardNumber("");
    } catch (error) {
      setCreateError(getApiError(error, t("cards.createError")));
    }
  };

  const openDelete = (card) => {
    setDeleteError("");
    setDeleteTarget(card);
  };

  const closeDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError("");
    try {
      await deleteCardMaster(deleteTarget._id).unwrap();
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(getApiError(error, t("cards.deleteError")));
    }
  };

  const columns = [
    { field: "card_number", headerName: t("cards.number"), flex: 1, minWidth: 160 },
    { field: "created_by", headerName: t("cards.createdBy"), flex: 1, minWidth: 160 },
    {
      field: "actions",
      headerName: t("common:fields.action"),
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Button
          color="error"
          size="small"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => openDelete(row)}
          aria-label={t("cards.deleteAria", { number: row.card_number })}
        >
          {t("common:actions.delete")}
        </Button>
      ),
    },
  ];

  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">{t("cards.title")}</Typography>
        <Button variant="contained" onClick={openCreate}>{t("cards.add")}</Button>
      </Stack>

      {isFetching && !isLoading ? <Alert severity="info" sx={{ mb: 1 }}>{t("common:states.refreshing")}</Alert> : null}
      {isLoading && <LoadingState label={t("cards.loading")} />}
      {queryError && !isLoading && !cards.length && (
        <ErrorState message={getApiError(queryError, t("cards.loadError"))} busy={isFetching} onAction={refetch} />
      )}
      {queryError && !isLoading && cards.length ? (
        <ErrorState message={getApiError(queryError, t("cards.loadError"))} busy={isFetching} onAction={refetch} />
      ) : null}
      {!isLoading && (!queryError || cards.length > 0) && (
        <LocalizedDataGrid
          autoHeight
          rows={cards}
          columns={columns}
          getRowId={(row) => row._id}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
          pageSizeOptions={[5]}
          density="compact"
          disableRowSelectionOnClick
        />
      )}

      <FormDialog
        open={createOpen}
        title={t("cards.add")}
        formId="card-master-form"
        loading={isCreating}
        onClose={closeCreate}
        onSubmit={submitCreate}
      >
        {createError && <ErrorState message={createError} />}
        <TextField
          autoFocus
          fullWidth
          required
          label={t("cards.number")}
          margin="normal"
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
        />
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("cards.deleteTitle")}
        message={deleteError || t("cards.deleteMessage", { number: deleteTarget?.card_number || "" })}
        loading={isDeleting}
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default CardMasterSection;

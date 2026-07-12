import React, { useState } from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import FormDialog from "../components/common/FormDialog.js";
import { getApiError } from "../domain/api-error.js";
import {
  useDeleteCardMasterMutation,
  useGetCardMasterQuery,
  useStoreCardMasterMutation,
} from "../redux/services/settings.js";

const CardMasterSection = () => {
  const { data: cards = [], error: queryError, isLoading } = useGetCardMasterQuery();
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
      setCreateError("Card Number is required");
      return;
    }
    try {
      await storeCardMaster({ card_number: normalizedCardNumber }).unwrap();
      setCreateOpen(false);
      setCardNumber("");
    } catch (error) {
      setCreateError(getApiError(error, "Failed to create card master"));
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
      setDeleteError(getApiError(error, "Failed to delete card master"));
    }
  };

  const columns = [
    { field: "_id", headerName: "Card ID", flex: 1, minWidth: 220 },
    { field: "card_number", headerName: "Card Number", flex: 1, minWidth: 180 },
    { field: "created_by", headerName: "Created By", flex: 1, minWidth: 180 },
    {
      field: "actions",
      headerName: "Action",
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Button
          color="error"
          size="small"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => openDelete(row)}
          aria-label={`Delete card ${row.card_number}`}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Box component="section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">Card Master List</Typography>
        <Button variant="contained" onClick={openCreate}>Add New Card Master</Button>
      </Stack>

      {isLoading && <LoadingState label="Loading card masters..." />}
      {queryError && !isLoading && (
        <ErrorState message={getApiError(queryError, "Failed to load card masters")} />
      )}
      {!isLoading && !queryError && (
        <DataGrid
          autoHeight
          rows={cards}
          columns={columns}
          getRowId={(row) => row._id}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }}
          pageSizeOptions={[5]}
          disableRowSelectionOnClick
        />
      )}

      <FormDialog
        open={createOpen}
        title="Add New Card Master"
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
          label="Card Number"
          margin="normal"
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
        />
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Card Master"
        message={deleteError || `Delete card ${deleteTarget?.card_number || ""}?`}
        loading={isDeleting}
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default CardMasterSection;

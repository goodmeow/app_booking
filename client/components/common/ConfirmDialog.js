import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useTranslation } from "react-i18next";

const ConfirmDialog = ({ open, title, message, loading = false, onCancel, onConfirm }) => {
  const { t } = useTranslation("common");

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title ?? t("dialogs.confirmDelete")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>{t("actions.cancel")}</Button>
        <Button onClick={onConfirm} disabled={loading} color="error" variant="contained">
          {loading ? t("states.loading") : t("actions.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;

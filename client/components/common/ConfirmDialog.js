import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

const ConfirmDialog = ({ open, title = "Confirm Delete", message, loading = false, onCancel, onConfirm }) => (
  <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <DialogContentText>{message}</DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} disabled={loading}>Cancel</Button>
      <Button onClick={onConfirm} disabled={loading} color="error" variant="contained">
        {loading ? "Loading..." : "Confirm"}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;

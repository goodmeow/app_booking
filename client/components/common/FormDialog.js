import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

const FormDialog = ({ open, title, children, formId = "entity-form", loading = false, submitDisabled = false, submitLabel = "Save", onClose, onSubmit, maxWidth = "sm" }) => (
  <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth={maxWidth} fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent component="form" id={formId} onSubmit={onSubmit} sx={{ pt: 1 }}>
      {children}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>Cancel</Button>
      <Button type="submit" form={formId} variant="contained" disabled={loading || submitDisabled}>
        {loading ? "Loading..." : submitLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default FormDialog;

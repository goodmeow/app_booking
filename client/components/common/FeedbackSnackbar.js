import React from "react";
import { Alert, Snackbar } from "@mui/material";

const FeedbackSnackbar = ({ open, message, severity = "error", onClose }) => (
  <Snackbar open={open} autoHideDuration={5000} onClose={onClose} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
    <Alert severity={severity} onClose={onClose}>{message}</Alert>
  </Snackbar>
);

export default FeedbackSnackbar;

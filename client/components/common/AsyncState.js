import React from "react";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";

export const LoadingState = ({ label = "Loading..." }) => (
  <Box role="status" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, py: 4 }}>
    <CircularProgress size={24} />
    <Typography>{label}</Typography>
  </Box>
);

export const ErrorState = ({ message = "An error occured" }) => <Alert severity="error">{message}</Alert>;

export const EmptyState = ({ message = "No data" }) => (
  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>{message}</Typography>
);

import React from "react";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export const LoadingState = ({ label }) => {
  const { t } = useTranslation("common");

  return (
    <Box role="status" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, py: 4 }}>
      <CircularProgress size={24} />
      <Typography>{label ?? t("states.loading")}</Typography>
    </Box>
  );
};

export const ErrorState = ({ message }) => {
  const { t } = useTranslation("common");

  return <Alert severity="error">{message ?? t("states.error")}</Alert>;
};

export const EmptyState = ({ message }) => {
  const { t } = useTranslation("common");

  return (
    <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
      {message ?? t("states.empty")}
    </Typography>
  );
};

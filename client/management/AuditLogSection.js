import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import { useGetAuditLogQuery } from "../redux/services/audit.js";

const summary = (row) => {
  const values = row.new_values || row.old_values;
  if (!values) return "-";
  const entries = Array.isArray(values) ? values : [values];
  return entries.map((entry) => (
    typeof entry === "object" && entry !== null
      ? Object.entries(entry).map(([key, value]) => `${key}: ${value}`).join(" ")
      : String(entry)
  )).join("; ");
};

const AuditLogSection = () => {
  const { t, i18n } = useTranslation("management");
  const { data, isLoading, isError, error, refetch } = useGetAuditLogQuery(100);

  if (isLoading) return <Typography>{t("settings.audit.loading")}</Typography>;
  if (isError) {
    return (
      <Alert
        severity="error"
        action={<Button color="inherit" size="small" onClick={refetch}>{t("common:actions.retry")}</Button>}
      >
        {getApiError(error, t("settings.audit.loadError"))}
      </Alert>
    );
  }

  return (
    <Box component="section">
      <Typography variant="h6" component="h2" gutterBottom>
        {t("settings.audit.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.audit.description")}
      </Typography>
      {data?.length ? (
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader aria-label={t("settings.audit.title")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("settings.audit.time")}</TableCell>
                <TableCell>{t("settings.audit.actor")}</TableCell>
                <TableCell>{t("settings.audit.action")}</TableCell>
                <TableCell>{t("settings.audit.details")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {new Date(row.created_at).toLocaleString(i18n.resolvedLanguage || i18n.language)}
                  </TableCell>
                  <TableCell>{row.actor_name || "-"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={t(`settings.audit.actions.${row.action}`, { defaultValue: row.action })} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" component="div" sx={{ wordBreak: "break-word" }}>
                      {summary(row)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">{t("settings.audit.empty")}</Alert>
      )}
    </Box>
  );
};

export default AuditLogSection;

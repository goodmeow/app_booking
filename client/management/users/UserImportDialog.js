import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { getApiError } from "../../domain/api-error.js";
import { parseUserCsv } from "../../domain/users/user-import-csv.js";
import { useImportUsersMutation } from "../../redux/services/users.js";

const TEMPLATE = "employee_id,name,email,role,floor,card_number";

const UserImportDialog = ({ open, onClose, onImported }) => {
  const { t } = useTranslation(["management", "common"]);
  const [importUsers, { isLoading }] = useImportUsersMutation();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState("skip");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    setMode("skip");
    setError("");
    setResult(null);
  };

  const close = () => {
    if (isLoading) return;
    reset();
    onClose?.();
  };

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    setResult(null);
    if (!file) return;
    try {
      const parsed = parseUserCsv(await file.text());
      setRows(parsed);
      setFileName(file.name);
    } catch (reason) {
      setRows([]);
      setFileName("");
      setError(reason.message || t("users.importParseError"));
    }
  };

  const submit = async () => {
    setError("");
    try {
      const summary = await importUsers({ rows, mode }).unwrap();
      setResult(summary);
      onImported?.(summary);
    } catch (reason) {
      setError(getApiError(reason, t("users.importError")));
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{t("users.importTitle")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("users.importHelp")}
          </Typography>
          <Box component="code" sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1, fontSize: 12 }}>
            {TEMPLATE}
          </Box>
          <Button component="label" variant="outlined" disabled={isLoading}>
            {fileName || t("users.importChoose")}
            <input hidden type="file" accept=".csv,text/csv" onChange={pickFile} />
          </Button>
          {rows.length ? (
            <Alert severity="info">{t("users.importRows", { count: rows.length })}</Alert>
          ) : null}
          <TextField
            select
            size="small"
            label={t("users.importMode")}
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            helperText={t("users.importModeHelp")}
            disabled={isLoading}
          >
            <MenuItem value="skip">{t("users.importSkip")}</MenuItem>
            <MenuItem value="overwrite">{t("users.importOverwrite")}</MenuItem>
          </TextField>
          <Typography variant="caption" color="text.secondary">
            {t("users.importPasswordNote")}
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {result ? (
            <Alert severity={result.failed ? "warning" : "success"}>
              <Typography variant="body2">
                {t("users.importSummary", {
                  created: result.created,
                  updated: result.updated,
                  skipped: result.skipped,
                  failed: result.failed,
                })}
              </Typography>
              {result.errors?.length ? (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  {result.errors.slice(0, 5).map((item) => (
                    <li key={`${item.row}-${item.employee_id}`}>
                      <Typography variant="caption">
                        {t("users.importErrorRow", { row: item.row, employee: item.employee_id, message: item.message })}
                      </Typography>
                    </li>
                  ))}
                </Box>
              ) : null}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={isLoading}>{t("common:actions.close")}</Button>
        <Button variant="contained" onClick={submit} disabled={isLoading || !rows.length}>
          {isLoading ? t("users.importing") : t("users.importSubmit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserImportDialog;

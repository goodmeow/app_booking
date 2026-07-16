import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useTranslation } from "react-i18next";

const FormDialog = ({ open, title, children, formId = "entity-form", loading = false, submitDisabled = false, submitLabel, onClose, onSubmit, maxWidth = "sm" }) => {
  const { t } = useTranslation("common");

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent component="form" id={formId} onSubmit={onSubmit} sx={{ pt: 1 }}>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{t("actions.cancel")}</Button>
        <Button type="submit" form={formId} variant="contained" disabled={loading || submitDisabled}>
          {loading ? t("states.loading") : submitLabel ?? t("actions.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FormDialog;

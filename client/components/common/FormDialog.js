import React from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useTranslation } from "react-i18next";

const FormDialog = ({ open, title, children, formId = "entity-form", loading = false, submitDisabled = false, submitLabel, onClose, onSubmit, maxWidth = "sm" }) => {
  const { t } = useTranslation("common");

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {/* DialogContent is always a div, so the form element is created explicitly
            so a submit button with the form={formId} attribute is really connected. */}
        <Box component="form" id={formId} onSubmit={onSubmit} noValidate>
          {children}
        </Box>
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

import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Divider, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import {
  useDeleteBrandAssetMutation,
  useGetBrandingQuery,
  useUpdateBrandingMutation,
  useUploadBrandAssetMutation,
} from "../redux/services/settings.js";

const ASSETS = [
  { kind: "mark", label: "branding.mark", fallback: "/the-prasada-mark.png", previewHeight: 64 },
  { kind: "wordmark", label: "branding.wordmark", fallback: "/the-prasada-wordmark.png", previewHeight: 28 },
  { kind: "favicon", label: "branding.favicon", fallback: "/the-prasada-mark.png", previewHeight: 32 },
];

const MAX_BYTES = 512 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]);

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("read failed"));
  reader.readAsDataURL(file);
});

const BrandingSection = () => {
  const { t } = useTranslation("management");
  const { data: branding, isLoading } = useGetBrandingQuery();
  const [updateBranding, { isLoading: saving }] = useUpdateBrandingMutation();
  const [uploadAsset, { isLoading: uploading }] = useUploadBrandAssetMutation();
  const [deleteAsset] = useDeleteBrandAssetMutation();
  const [form, setForm] = useState({ brand_name: "", document_title: "" });
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (branding) {
      setForm({
        brand_name: branding.brand_name || "",
        document_title: branding.document_title || "",
      });
    }
  }, [branding]);

  const saveText = async (event) => {
    event.preventDefault();
    setFeedback(null);
    try {
      await updateBranding(form).unwrap();
      setFeedback({ severity: "success", message: t("branding.saved") });
    } catch (error) {
      setFeedback({ severity: "error", message: getApiError(error, t("branding.saveError")) });
    }
  };

  const upload = async (kind, file) => {
    setFeedback(null);
    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      setFeedback({ severity: "error", message: t("branding.invalidType") });
      return;
    }
    if (file.size > MAX_BYTES) {
      setFeedback({ severity: "error", message: t("branding.tooLarge") });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadAsset({ kind, dataUrl }).unwrap();
      setFeedback({ severity: "success", message: t("branding.uploaded") });
    } catch (error) {
      setFeedback({ severity: "error", message: getApiError(error, t("branding.uploadError")) });
    }
  };

  const reset = async (kind) => {
    setFeedback(null);
    try {
      await deleteAsset(kind).unwrap();
      setFeedback({ severity: "success", message: t("branding.resetDone") });
    } catch (error) {
      setFeedback({ severity: "error", message: getApiError(error, t("branding.uploadError")) });
    }
  };

  if (isLoading) return <Typography>{t("branding.loading")}</Typography>;

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Typography variant="h6" component="h2" gutterBottom>{t("branding.title")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("branding.description")}
      </Typography>

      <Stack spacing={2}>
        <TextField
          size="small"
          label={t("branding.name")}
          value={form.brand_name}
          onChange={(event) => setForm((current) => ({ ...current, brand_name: event.target.value }))}
          inputProps={{ maxLength: 80 }}
          disabled={saving}
        />
        <TextField
          size="small"
          label={t("branding.documentTitle")}
          value={form.document_title}
          onChange={(event) => setForm((current) => ({ ...current, document_title: event.target.value }))}
          inputProps={{ maxLength: 120 }}
          disabled={saving}
        />
        <Box>
          <Button type="button" variant="contained" disabled={saving} onClick={saveText}>{t("branding.save")}</Button>
        </Box>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Stack spacing={2}>
        {ASSETS.map(({ kind, label, fallback, previewHeight }) => (
          <Box key={kind}>
            <Typography variant="subtitle2" gutterBottom>{t(label)}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
              <Box
                component="img"
                src={branding?.assets?.[kind] || fallback}
                alt=""
                sx={{ height: previewHeight, width: "auto", maxWidth: 240, objectFit: "contain", bgcolor: "background.paper", p: 0.5 }}
              />
              <Button component="label" variant="outlined" disabled={uploading}>
                {t("branding.upload")}
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/x-icon"
                  onChange={(event) => {
                    upload(kind, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </Button>
              {branding?.assets?.[kind] ? (
                <Button color="inherit" onClick={() => reset(kind)} disabled={uploading}>{t("branding.reset")}</Button>
              ) : null}
            </Stack>
          </Box>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {t("branding.help")}
      </Typography>

      {feedback ? <Alert severity={feedback.severity} sx={{ mt: 2 }}>{feedback.message}</Alert> : null}
    </Box>
  );
};

export default BrandingSection;

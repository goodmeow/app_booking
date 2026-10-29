import React, { useEffect, useState } from "react";
import { Alert, Button, Divider, Input, Space, Typography, Upload } from "antd";
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
    event?.preventDefault();
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

  if (isLoading) return <Typography.Text>{t("branding.loading")}</Typography.Text>;

  return (
    <div style={{ maxWidth: 760 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>{t("branding.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">{t("branding.description")}</Typography.Paragraph>

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <Typography.Text strong>{t("branding.name")}</Typography.Text>
          <Input
            maxLength={80}
            value={form.brand_name}
            onChange={(event) => setForm((current) => ({ ...current, brand_name: event.target.value }))}
            disabled={saving}
          />
        </div>
        <div>
          <Typography.Text strong>{t("branding.documentTitle")}</Typography.Text>
          <Input
            maxLength={120}
            value={form.document_title}
            onChange={(event) => setForm((current) => ({ ...current, document_title: event.target.value }))}
            disabled={saving}
          />
        </div>
        <Button type="primary" onClick={saveText} disabled={saving}>
          {t("branding.save")}
        </Button>
      </Space>

      <Divider style={{ margin: "24px 0" }} />

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {ASSETS.map(({ kind, label, fallback, previewHeight }) => (
          <div key={kind}>
            <Typography.Text strong>{t(label)}</Typography.Text>
            <Space wrap size="middle" align="center" style={{ marginTop: 8 }}>
              <img
                src={branding?.assets?.[kind] || fallback}
                alt=""
                style={{
                  height: previewHeight,
                  width: "auto",
                  maxWidth: 240,
                  objectFit: "contain",
                  background: "#171E26",
                  padding: 4,
                }}
              />
              <Upload
                accept="image/png,image/jpeg,image/webp,image/x-icon"
                showUploadList={false}
                disabled={uploading}
                beforeUpload={(file) => {
                  void upload(kind, file);
                  return false;
                }}
              >
                <Button disabled={uploading}>{t("branding.upload")}</Button>
              </Upload>
              {branding?.assets?.[kind] ? (
                <Button onClick={() => reset(kind)} disabled={uploading}>{t("branding.reset")}</Button>
              ) : null}
            </Space>
          </div>
        ))}
      </Space>
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
        {t("branding.help")}
      </Typography.Text>

      {feedback ? (
        <Alert type={feedback.severity} showIcon message={feedback.message} style={{ marginTop: 16 }} />
      ) : null}
    </div>
  );
};

export default BrandingSection;

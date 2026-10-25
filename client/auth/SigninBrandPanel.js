import React from "react";
import { useTranslation } from "react-i18next";
import { brandAsset } from "../core/brand-assets.js";
import { useGetBrandingQuery } from "../redux/services/settings.js";

// Brand lockup for the sign-in page: the mark on top, the wordmark below it,
// and the admin panel label. Asset URLs come from Global Settings.
const SigninBrandPanel = () => {
  const { t } = useTranslation("common");
  const { data: branding } = useGetBrandingQuery();

  return (
    <section
      aria-label="The Prasada"
      style={{
        flex: "1 1 480px",
        boxSizing: "border-box",
        minHeight: 360,
        padding: 56,
        background: "#1A2027",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <img
        src={brandAsset(branding, "mark")}
        alt="The Prasada"
        style={{ display: "block", height: 150, width: "auto" }}
      />
      <img
        src={brandAsset(branding, "wordmark")}
        alt=""
        style={{ display: "block", height: 46, width: "auto" }}
      />
      <div style={{ fontSize: 20, fontWeight: 600, color: "#A9B3BF" }}>{t("brand.adminPanel")}</div>
    </section>
  );
};

export default SigninBrandPanel;

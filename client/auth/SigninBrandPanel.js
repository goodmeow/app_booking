import React from "react";
import { useTranslation } from "react-i18next";

// Static identity lockup for the sign-in page: the mark on top, the wordmark
// below it, and the admin panel label. No state, no handlers.
const SigninBrandPanel = () => {
  const { t } = useTranslation("common");

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
        src="/the-prasada-mark.png"
        alt="The Prasada"
        style={{ display: "block", height: 150, width: "auto" }}
      />
      <img
        src="/the-prasada-wordmark.png"
        alt=""
        style={{ display: "block", height: 46, width: "auto" }}
      />
      <div style={{ fontSize: 20, fontWeight: 600, color: "#A9B3BF" }}>{t("brand.adminPanel")}</div>
    </section>
  );
};

export default SigninBrandPanel;

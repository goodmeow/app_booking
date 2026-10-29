import React from "react";
import { Typography } from "antd";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { CMS_VERSION } from "./version.js";

// Version footer on every web page (including the sign-in page). The text goes
// through i18n; the Ver.Rev numbers still come from package.json via version.js.
const VersionFooter = () => {
  const { t } = useTranslation("common");
  return (
    <footer
      style={{
        flexShrink: 0,
        padding: "16px 24px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      <LanguageSwitcher />
      <Typography.Text type="secondary" style={{ marginLeft: "auto", textAlign: "right" }}>
        {t("brand.footer", { version: CMS_VERSION })}
      </Typography.Text>
    </footer>
  );
};

export default VersionFooter;

import React from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { CMS_VERSION } from "./version.js";

// Version footer on every web page (including the sign-in page). The text goes
// through i18n; the Ver.Rev numbers still come from package.json via version.js.
const VersionFooter = () => {
  const { t } = useTranslation("common");
  return (
    <Box
      component="footer"
      sx={{
        pt: 2,
        pb: 2,
        px: { xs: 2, md: 4 },
        color: "text.disabled",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <LanguageSwitcher />
      <Box sx={{ typography: "caption", display: "block", ml: "auto", textAlign: "right" }}>
        {t("brand.footer", { version: CMS_VERSION })}
      </Box>
    </Box>
  );
};

export default VersionFooter;

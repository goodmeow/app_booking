import React from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CMS_VERSION } from "./version.js";

// Version footer on every web page (including the sign-in page). The text goes
// through i18n; the Ver.Rev numbers still come from package.json via version.js.
const VersionFooter = () => {
  const { t } = useTranslation("common");
  return (
    <Box
      component="footer"
      sx={{
        pt: 6,
        pb: 3,
        textAlign: "center",
        color: "text.disabled",
      }}
    >
      <Box sx={{ typography: "caption", display: "block" }}>
        {t("brand.footer", { version: CMS_VERSION })}
      </Box>
    </Box>
  );
};

export default VersionFooter;

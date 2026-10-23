import React from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CMS_VERSION } from "./version.js";

// Footer versi di semua halaman web (termasuk halaman masuk). Teks diteruskan
// i18n; angka Ver.Rev tetap ikut package.json lewat version.js.
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

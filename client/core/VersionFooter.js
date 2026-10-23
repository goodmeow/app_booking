import React from "react";
import { Box } from "@mui/material";
import { CMS_VERSION } from "./version.js";

// Footer versi di semua halaman web (termasuk halaman masuk). Angka Ver.Rev
// ikut package.json lewat version.js; naikkan di sana (docs/VERSIONING.md).
const VersionFooter = () => (
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
      {`360 Scheduler CMS v${CMS_VERSION}`}
    </Box>
  </Box>
);

export default VersionFooter;

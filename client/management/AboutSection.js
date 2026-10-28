import React from "react";
import {
  Box,
  Divider,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { CMS_VERSION } from "../core/version.js";
import { CMS_LIBRARIES, KIOSK_APP_VERSION, KIOSK_LIBRARIES } from "../domain/licenses.js";

const LicenseTable = ({ rows, t, title }) => (
  <Box component="section" sx={{ mt: 3 }}>
    <Typography variant="h6" component="h2" gutterBottom>{title}</Typography>
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label={title}>
        <TableHead>
          <TableRow>
            <TableCell>{t("about.library")}</TableCell>
            <TableCell>{t("about.version")}</TableCell>
            <TableCell>{t("about.license")}</TableCell>
            <TableCell>{t("about.source")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={`${item.name}-${item.version}`}>
              <TableCell component="th" scope="row">{item.name}</TableCell>
              <TableCell>{item.version}</TableCell>
              <TableCell>{item.license}</TableCell>
              <TableCell>
                <Link href={item.url} target="_blank" rel="noopener noreferrer">
                  {t("about.openSource")}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Box>
);

const AboutSection = () => {
  const { t } = useTranslation("management");
  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>{t("about.title")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("about.intro")}
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Typography variant="body2"><strong>CMS/API:</strong> {CMS_VERSION}</Typography>
        <Typography variant="body2"><strong>Kiosk APK:</strong> {KIOSK_APP_VERSION}</Typography>
      </Stack>
      <Divider />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {t("about.note")}
      </Typography>
      <LicenseTable rows={CMS_LIBRARIES} t={t} title={t("about.cmsLibraries")} />
      <LicenseTable rows={KIOSK_LIBRARIES} t={t} title={t("about.kioskLibraries")} />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }}>
        {t("about.copyright")}
      </Typography>
    </Box>
  );
};

export default AboutSection;

import React from "react";
import { Container, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useGetSettingsQuery } from "../redux/services/settings.js";
import CardMasterSection from "./CardMasterSection.js";
import RoomManagementSection from "./RoomManagementSection.js";
import UserManagementSection from "./UserManagementSection.js";
import KioskDeviceManagementSection from "./KioskDeviceManagementSection.js";

const AppManagement = () => {
  const { t } = useTranslation("management");
  // Recovered page loads settings, but exposes no confirmed settings controls.
  useGetSettingsQuery();

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>{t("page.title")}</Typography>
      <Stack spacing={4}>
        <Paper sx={{ p: 3 }}><CardMasterSection /></Paper>
        <Paper sx={{ p: 3 }}><UserManagementSection /></Paper>
        <Paper sx={{ p: 3 }}><RoomManagementSection /></Paper>
        <Paper sx={{ p: 3 }}><KioskDeviceManagementSection /></Paper>
      </Stack>
    </Container>
  );
};

export default AppManagement;

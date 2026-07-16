import React, { useState } from "react";
import { Container, Paper, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useGetSettingsQuery } from "../redux/services/settings.js";
import CardMasterSection from "./CardMasterSection.js";
import RoomManagementSection from "./RoomManagementSection.js";
import UserManagementSection from "./UserManagementSection.js";
import KioskDeviceManagementSection from "./KioskDeviceManagementSection.js";

const AppManagement = () => {
  const { t } = useTranslation("management");
  const [section, setSection] = useState("users");
  // Recovered page loads settings, but exposes no confirmed settings controls.
  useGetSettingsQuery();
  const sections = [
    { value: "users", label: t("users.title"), content: <UserManagementSection /> },
    { value: "rooms", label: t("rooms.title"), content: <RoomManagementSection /> },
    { value: "cards", label: t("cards.title"), content: <CardMasterSection /> },
    { value: "devices", label: t("devices.title"), content: <KioskDeviceManagementSection /> },
  ];
  const active = sections.find((item) => item.value === section) || sections[0];

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>{t("page.title")}</Typography>
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={active.value}
          onChange={(_event, value) => setSection(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t("page.navigation")}
        >
          {sections.map((item) => <Tab key={item.value} value={item.value} label={item.label} />)}
        </Tabs>
      </Paper>
      <Paper sx={{ p: { xs: 1.5, sm: 3 }, overflow: "hidden" }}>
        {active.content}
      </Paper>
    </Container>
  );
};

export default AppManagement;

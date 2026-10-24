import React, { useState } from "react";
import { Container, Paper, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useGetSettingsQuery } from "../redux/services/settings.js";
import RoomManagementSection from "./RoomManagementSection.js";
import UserManagementSection from "./UserManagementSection.js";
import KioskDeviceManagementSection from "./KioskDeviceManagementSection.js";
import SettingsSection from "./SettingsSection.js";

const AppManagement = () => {
  const { t } = useTranslation("management");
  const location = useLocation();
  const requestedSection = new URLSearchParams(location.search).get("section");
  const [section, setSection] = useState(requestedSection || "users");
  // Recovered page loads settings, but exposes no confirmed settings controls.
  useGetSettingsQuery();
  const sections = [
    { value: "users", label: t("users.title"), content: <UserManagementSection /> },
    { value: "rooms", label: t("rooms.title"), content: <RoomManagementSection /> },
    { value: "devices", label: t("devices.title"), content: <KioskDeviceManagementSection /> },
    { value: "settings", label: t("settings.tab"), content: <SettingsSection /> },
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

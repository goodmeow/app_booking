import React, { useEffect, useState } from "react";
import { Alert, Container, Paper, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import RoomManagementSection from "./RoomManagementSection.js";
import UserManagementSection from "./UserManagementSection.js";
import KioskDeviceManagementSection from "./KioskDeviceManagementSection.js";
import SettingsSection from "./SettingsSection.js";
import { useMenuAccess } from "../auth/use-menu-access.js";

const AppManagement = () => {
  const { t } = useTranslation("management");
  const location = useLocation();
  const requestedSection = new URLSearchParams(location.search).get("section");
  const [section, setSection] = useState(requestedSection || "users");
  const { can, isLoading } = useMenuAccess();
  const allSections = [
    { value: "users", menu: "users", label: t("users.title"), content: <UserManagementSection /> },
    { value: "rooms", menu: "rooms", label: t("rooms.title"), content: <RoomManagementSection /> },
    { value: "devices", menu: "devices", label: t("devices.title"), content: <KioskDeviceManagementSection /> },
    { value: "settings", menu: "settings", label: t("settings.tab"), content: <SettingsSection /> },
  ];
  const sections = allSections.filter((item) => can(item.menu));
  const visibleValues = sections.map((item) => item.value).join(",");
  useEffect(() => {
    if (!sections.some((item) => item.value === section)) setSection(sections[0]?.value || "");
  }, [section, visibleValues]);
  const active = sections.find((item) => item.value === section) || sections[0];

  if (isLoading) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Typography>{t("common:states.loading")}</Typography>
      </Container>
    );
  }

  if (!active) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Alert severity="warning">{t("page.noAccess")}</Alert>
      </Container>
    );
  }

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

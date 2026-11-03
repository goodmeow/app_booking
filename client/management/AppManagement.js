import React, { useEffect, useState } from "react";
import { Alert, Card, Tabs, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import RoomManagementSection from "./RoomManagementSection.js";
import UserManagementSection from "./UserManagementSection.js";
import KioskDeviceManagementSection from "./KioskDeviceManagementSection.js";
import SettingsSection from "./SettingsSection.js";
import AboutSection from "./AboutSection.js";
import { LoadingState } from "../components/common/AsyncState.js";
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
    { value: "about", menu: null, label: t("about.tab"), content: <AboutSection /> },
  ];
  const sections = allSections.filter((item) => !item.menu || can(item.menu));
  const visibleValues = sections.map((item) => item.value).join(",");
  useEffect(() => {
    if (!sections.some((item) => item.value === section)) setSection(sections[0]?.value || "");
  }, [section, visibleValues]);
  const active = sections.find((item) => item.value === section) || sections[0];

  if (isLoading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingState label={t("common:states.loading")} />
      </div>
    );
  }

  if (!active) {
    return (
      <div style={{ padding: 32 }}>
        <Alert type="warning" showIcon message={t("page.noAccess")} />
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: "100%" }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>{t("page.title")}</Typography.Title>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={active.value}
          onChange={setSection}
          items={sections.map(({ value, label, content }) => ({
            key: value,
            label,
            children: <div style={{ padding: 24 }}>{content}</div>,
          }))}
          tabBarStyle={{ padding: "0 16px", margin: 0 }}
        />
      </Card>
    </div>
  );
};

export default AppManagement;

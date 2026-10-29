import { theme as antdTheme } from "antd";

// The CMS theme keeps the kiosk tablet identity: accent #3DDC84, brand #0B6B3A,
// and the Public Sans font self-hosted in fonts.css. AntD supplies the neutral
// surfaces; only brand colours, contrast, and the shared shape are overridden.
export const createAppTheme = (mode = "dark") => {
  const dark = mode === "dark";

  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: "#2FB46A",
      colorSuccess: "#3DDC84",
      colorWarning: "#FFB800",
      colorError: "#FF8A80",
      colorInfo: "#7EC8FF",
      colorBgBase: dark ? "#11151B" : "#F3F6F9",
      colorBgLayout: dark ? "#11151B" : "#F3F6F9",
      colorBgContainer: dark ? "#171E26" : "#FFFFFF",
      colorBgElevated: dark ? "#1C2530" : "#FFFFFF",
      colorText: dark ? "#EDF2F6" : "#11151B",
      colorTextSecondary: dark ? "#9FB0BF" : "#5A6673",
      colorBorder: dark ? "#2A3540" : "#D9E0E7",
      colorSplit: dark ? "rgba(235,244,240,0.10)" : "rgba(17,21,27,0.10)",
      borderRadius: 10,
      fontFamily:
        '"Public Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    },
    components: {
      Layout: {
        headerBg: "#0C1014",
        bodyBg: dark ? "#11151B" : "#F3F6F9",
        siderBg: dark ? "#0C1014" : "#FFFFFF",
      },
      Menu: dark ? {
        darkItemBg: "#0C1014",
        darkSubMenuItemBg: "#0C1014",
        darkItemSelectedBg: "#2FB46A",
        darkItemSelectedColor: "#0A1F14",
      } : {},
      Table: {
        headerBg: dark ? "#171E26" : "#F5F7FA",
        rowHoverBg: dark ? "#1C2530" : "#F0F4F8",
        borderColor: dark ? "#2A3540" : "#D9E0E7",
      },
      Modal: {
        contentBg: dark ? "#171E26" : "#FFFFFF",
        headerBg: dark ? "#171E26" : "#FFFFFF",
      },
      Button: {
        defaultShadow: "none",
        primaryShadow: "none",
      },
    },
  };
};

export default createAppTheme("dark");

import { theme as antdTheme } from "antd";

// The CMS theme matches the kiosk tablet identity: background #11151B,
// accent #3DDC84, brand #0B6B3A, and the Public Sans font self-hosted in
// fonts.css. AntD darkAlgorithm supplies the neutral surfaces; only brand
// colours and the shared shape are overridden.
const theme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: "#2FB46A",
    colorSuccess: "#3DDC84",
    colorWarning: "#FFB800",
    colorError: "#FF8A80",
    colorInfo: "#7EC8FF",
    colorBgBase: "#11151B",
    colorBgLayout: "#11151B",
    colorBgContainer: "#171E26",
    colorBgElevated: "#1C2530",
    colorText: "#EDF2F6",
    colorTextSecondary: "#9FB0BF",
    colorBorder: "#2A3540",
    colorSplit: "rgba(235,244,240,0.10)",
    borderRadius: 10,
    fontFamily:
      '"Public Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  components: {
    Layout: {
      headerBg: "#0C1014",
      bodyBg: "#11151B",
      siderBg: "#0C1014",
    },
    Menu: {
      darkItemBg: "#0C1014",
      darkSubMenuItemBg: "#0C1014",
      darkItemSelectedBg: "#2FB46A",
      darkItemSelectedColor: "#0A1F14",
    },
    Table: {
      headerBg: "#171E26",
      rowHoverBg: "#1C2530",
      borderColor: "#2A3540",
    },
    Modal: {
      contentBg: "#171E26",
      headerBg: "#171E26",
    },
    Button: {
      defaultShadow: "none",
      primaryShadow: "none",
    },
  },
};

export default theme;

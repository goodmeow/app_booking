import React, { useEffect } from "react";
import { theme } from "antd";
import { useThemeMode } from "../theme-mode.js";

// Bridges AntD design tokens into the few places that are not AntD components:
// the page background and FullCalendar's CSS variables.
const ThemeShell = ({ children }) => {
  const { mode } = useThemeMode();
  const { token } = theme.useToken();

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
    document.body.style.background = token.colorBgLayout;
    document.body.style.color = token.colorText;
  }, [mode, token.colorBgLayout, token.colorText]);

  return (
    <div
      data-theme={mode}
      style={{
        minHeight: "100vh",
        background: token.colorBgLayout,
        color: token.colorText,
        "--fc-border-color": token.colorBorder,
        "--fc-page-bg-color": token.colorBgContainer,
        "--fc-page-text-color": token.colorText,
        "--fc-neutral-bg-color": token.colorFillTertiary,
        "--fc-neutral-text-color": token.colorTextSecondary,
        "--fc-today-bg-color": token.colorPrimaryBg,
        "--fc-now-indicator-color": token.colorPrimary,
        "--fc-list-event-hover-bg-color": token.colorFillTertiary,
        "--fc-button-bg-color": token.colorFillTertiary,
        "--fc-button-border-color": token.colorBorder,
        "--fc-button-text-color": token.colorText,
        "--fc-button-hover-bg-color": token.colorFillSecondary,
        "--fc-button-hover-border-color": token.colorBorder,
        "--fc-button-active-bg-color": token.colorPrimary,
        "--fc-button-active-border-color": token.colorPrimary,
      }}
    >
      {children}
    </div>
  );
};

export default ThemeShell;

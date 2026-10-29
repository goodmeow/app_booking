import React, { useEffect, useMemo, useState } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import idID from "antd/locale/id_ID";
import { useTranslation } from "react-i18next";
import MainRouter from "./MainRouter.js";
import ThemeShell from "./core/ThemeShell.js";
import { createAppTheme } from "./theme.js";
import { ThemeModeContext } from "./theme-mode.js";
import DocumentLocale from "./i18n/DocumentLocale.js";
import "antd/dist/reset.css";

const THEME_STORAGE_KEY = "cms-theme";

const readInitialTheme = () => {
  try {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
};

const App = () => {
  const { i18n } = useTranslation();
  const [themeMode, setThemeMode] = useState(readInitialTheme);
  const language = i18n.resolvedLanguage || i18n.language || "";
  const antdLocale = language.startsWith("id") ? idID : enUS;
  const antdTheme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Theme preference is optional; blocked storage must not break the UI.
    }
  }, [themeMode]);

  const themeContext = useMemo(() => ({
    mode: themeMode,
    toggle: () => setThemeMode((current) => (current === "dark" ? "light" : "dark")),
  }), [themeMode]);

  return (
    <ThemeModeContext.Provider value={themeContext}>
      <ConfigProvider theme={antdTheme} locale={antdLocale}>
        <AntApp>
          <ThemeShell>
            <DocumentLocale />
            <MainRouter />
          </ThemeShell>
        </AntApp>
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
};

export default App;

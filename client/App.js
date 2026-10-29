import React from "react";
import { App as AntApp, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import idID from "antd/locale/id_ID";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { useTranslation } from "react-i18next";
import MainRouter from "./MainRouter.js";
import theme, { antdThemeConfig } from "./theme.js";
import DocumentLocale from "./i18n/DocumentLocale.js";
import "antd/dist/reset.css";

const App = () => {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "";
  const antdLocale = language.startsWith("id") ? idID : enUS;

  return (
    <ConfigProvider theme={antdThemeConfig} locale={antdLocale}>
      <AntApp>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <DocumentLocale />
          <MainRouter />
        </ThemeProvider>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;

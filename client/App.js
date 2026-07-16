import React from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import MainRouter from "./MainRouter.js";
import theme from "./theme.js";
import DocumentLocale from "./i18n/DocumentLocale.js";

const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <DocumentLocale />
    <MainRouter />
  </ThemeProvider>
);

export default App;

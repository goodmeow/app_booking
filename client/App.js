import React from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import MainRouter from "./MainRouter.js";
import theme from "./theme.js";

const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <MainRouter />
  </ThemeProvider>
);

export default App;

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#0f6cbd" },
    secondary: { main: "#0f6cbd" },
    background: { default: "#ffffff" },
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
});

export default theme;

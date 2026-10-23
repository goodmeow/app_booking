import { createTheme } from "@mui/material/styles";

// The CMS theme matches the kiosk tablet identity (App.tsx in kioskapp): background
// #11151B, accent #3DDC84, brand #0B6B3A, SOON yellow #FFB800, and the Public Sans
// font self-hosted in fonts.css. The sign-in page uses the same colours so the two
// screens form one family. Material is still used; only colour tokens and shapes
// are replaced.
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#2FB46A",
      dark: "#0B6B3A",
      light: "#3DDC84",
      contrastText: "#0A1F14",
    },
    secondary: { main: "#FFB800", contrastText: "#1F1500" },
    success: { main: "#3DDC84", contrastText: "#0A1F14" },
    warning: { main: "#FFB800", contrastText: "#1F1500" },
    error: { main: "#FF8A80", contrastText: "#2B0A06" },
    info: { main: "#7EC8FF" },
    background: { default: "#11151B", paper: "#171E26" },
    text: { primary: "#EDF2F6", secondary: "#9FB0BF" },
    divider: "rgba(235,244,240,0.10)",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"Public Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  components: {
    // The AppBar follows the tablet palette, not white; the brand icon keeps its contrast.
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundColor: "#0C1014", color: "#EDF2F6" } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});

export default theme;

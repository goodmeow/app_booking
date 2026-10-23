import { createTheme } from "@mui/material/styles";

// Tema CMS menyamai identitas tablet kios (App.tsx di kioskapp): latar
// #11151B, aksen #3DDC84, brand #0B6B3A, kuning SEGERA #FFB800, dan huruf
// Public Sans yang sudah self-host di fonts.css. Halaman masuk memakai
// warna yang sama sehingga dua layarnya jadi satu keluarga. Material tetap
// dipakai; hanya token warna dan bentuk yang diganti.
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
    // AppBar mengikuti palet tablet, bukan putih; ikon brand tetap kontras.
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

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#0f6cbd" },
    secondary: { main: "#003049" },
    background: { default: "#f7f9fc" },
  },
  typography: {
    fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
  },
});

export default theme;

import { createContext, useContext } from "react";

export const ThemeModeContext = createContext({
  mode: "dark",
  toggle: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);

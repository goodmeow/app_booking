import React from "react";
import { MenuItem, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
} from "../../i18n/languages.js";

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation("common");
  const currentLanguage = normalizeLanguage(
    i18n.resolvedLanguage || i18n.language
  );

  const handleLanguageChange = (event) => {
    void i18n.changeLanguage(event.target.value);
  };

  return (
    <TextField
      select
      size="small"
      value={currentLanguage}
      onChange={handleLanguageChange}
      label={t("language.label")}
      inputProps={{ "aria-label": t("language.ariaLabel") }}
      sx={{ minWidth: 150, bgcolor: "background.paper", borderRadius: 1 }}
    >
      {SUPPORTED_LANGUAGES.map(({ code, labelKey, nativeName }) => (
        <MenuItem key={code} value={code}>
          {t(labelKey, { defaultValue: nativeName })}
        </MenuItem>
      ))}
    </TextField>
  );
};

export default LanguageSwitcher;

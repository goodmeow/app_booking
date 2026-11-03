import React from "react";
import { Select } from "antd";
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

  const options = SUPPORTED_LANGUAGES.map(({ code, labelKey, nativeName }) => ({
    value: code,
    label: t(labelKey, { defaultValue: nativeName }),
  }));

  return (
    <Select
      size="small"
      value={currentLanguage}
      options={options}
      aria-label={t("language.ariaLabel")}
      onChange={(value) => void i18n.changeLanguage(value)}
      style={{ minWidth: 150 }}
    />
  );
};

export default LanguageSwitcher;

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  normalizeLanguage,
  persistLanguage,
  SUPPORTED_LANGUAGES,
} from "./languages.js";

const DocumentLocale = () => {
  const { i18n, t } = useTranslation("common");
  const currentLanguage = normalizeLanguage(
    i18n.resolvedLanguage || i18n.language
  );

  useEffect(() => {
    const language = persistLanguage(currentLanguage);
    const metadata = SUPPORTED_LANGUAGES.find(
      ({ code }) => code === language
    );

    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = language;
    document.documentElement.dir = metadata?.dir || "ltr";
    document.title = t("brand.documentTitle");
  }, [currentLanguage, t]);

  return null;
};

export default DocumentLocale;

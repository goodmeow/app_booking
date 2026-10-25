import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { brandAsset } from "../core/brand-assets.js";
import { useGetBrandingQuery } from "../redux/services/settings.js";
import {
  normalizeLanguage,
  persistLanguage,
  SUPPORTED_LANGUAGES,
} from "./languages.js";

const DocumentLocale = () => {
  const { i18n, t } = useTranslation("common");
  const { data: branding } = useGetBrandingQuery();
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
    document.title = branding?.document_title || t("brand.documentTitle");
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.setAttribute("href", brandAsset(branding, "favicon"));
  }, [branding, currentLanguage, t]);

  return null;
};

export default DocumentLocale;

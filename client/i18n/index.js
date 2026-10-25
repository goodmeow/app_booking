import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enAuth from "../locales/en/auth.json" with { type: "json" };
import enCalendar from "../locales/en/calendar.json" with { type: "json" };
import enCommon from "../locales/en/common.json" with { type: "json" };
import enKiosk from "../locales/en/kiosk.json" with { type: "json" };
import enManagement from "../locales/en/management.json" with { type: "json" };
import enReport from "../locales/en/report.json" with { type: "json" };
import idAuth from "../locales/id/auth.json" with { type: "json" };
import idCalendar from "../locales/id/calendar.json" with { type: "json" };
import idCommon from "../locales/id/common.json" with { type: "json" };
import idKiosk from "../locales/id/kiosk.json" with { type: "json" };
import idManagement from "../locales/id/management.json" with { type: "json" };
import idReport from "../locales/id/report.json" with { type: "json" };
import {
  DEFAULT_LANGUAGE,
  readStoredLanguage,
  SUPPORTED_LANGUAGES,
} from "./languages.js";

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    calendar: enCalendar,
    management: enManagement,
    report: enReport,
    kiosk: enKiosk,
  },
  id: {
    common: idCommon,
    auth: idAuth,
    calendar: idCalendar,
    management: idManagement,
    report: idReport,
    kiosk: idKiosk,
  },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: readStoredLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map(({ code }) => code),
    load: "currentOnly",
    defaultNS: "common",
    ns: ["common", "auth", "calendar", "management", "report", "kiosk"],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;

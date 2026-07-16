export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    locale: "en-GB",
    calendarLocale: "en-gb",
    labelKey: "language.english",
    nativeName: "English",
    dir: "ltr",
  },
  {
    code: "id",
    locale: "id-ID",
    calendarLocale: "id",
    labelKey: "language.indonesian",
    nativeName: "Bahasa Indonesia",
    dir: "ltr",
  },
];

export const LANGUAGE_STORAGE_KEY = "360scheduler.language";

export function normalizeLanguage(language) {
  if (typeof language !== "string") {
    return DEFAULT_LANGUAGE;
  }

  const normalized = language.trim().replace("_", "-");
  const exact = SUPPORTED_LANGUAGES.find(
    ({ code }) => code.toLowerCase() === normalized.toLowerCase()
  );
  if (exact) return exact.code;

  const base = normalized.split("-")[0].toLowerCase();
  return SUPPORTED_LANGUAGES.find(({ code }) => code.toLowerCase() === base)?.code
    || DEFAULT_LANGUAGE;
}

export function localeForLanguage(language) {
  const code = normalizeLanguage(language);
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.locale || code;
}

export function calendarLocaleForLanguage(language) {
  const code = normalizeLanguage(language);
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.calendarLocale || code;
}

export function readStoredLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    return normalizeLanguage(window.localStorage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function writeStoredLanguage(language) {
  const normalized = normalizeLanguage(language);

  if (typeof window === "undefined") return normalized;
  try {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Storage can be unavailable in private browsing, tests, or server rendering.
  }

  return normalized;
}

export const persistLanguage = writeStoredLanguage;

import { localeForLanguage } from "../i18n/languages.js";

const pad = (value) => String(value).padStart(2, "0");

export const kioskDayRange = (now = new Date()) => {
  const key = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return { start: key, end: key };
};

export const formatKioskTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatKioskDate = (value, language) => new Intl.DateTimeFormat(localeForLanguage(language), {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(value instanceof Date ? value : new Date(value));

export const deriveKioskState = (events = [], settings = {}, nowValue = new Date()) => {
  const now = nowValue instanceof Date ? nowValue.getTime() : new Date(nowValue).getTime();
  const sorted = [...events]
    .filter((event) => Number.isFinite(new Date(event.start).getTime()) && Number.isFinite(new Date(event.end).getTime()))
    .sort((left, right) => new Date(left.start) - new Date(right.start));
  const current = sorted.find((event) => new Date(event.start).getTime() <= now && now < new Date(event.end).getTime());
  const next = sorted.find((event) => new Date(event.start).getTime() > now) || null;
  if (current) return { mode: "occupied", current, next };
  if (next) {
    const minutesUntil = (new Date(next.start).getTime() - now) / 60_000;
    if (minutesUntil <= 60) return { mode: "upcoming", current: null, next };
  }
  return { mode: "available", current: null, next };
};

export const kioskPalette = {
  unknown: { main: "#455a64", dark: "#263238", labelKey: "states.unknown" },
  available: { main: "#0b7a53", dark: "#064e3b", labelKey: "states.available" },
  upcoming: { main: "#d97706", dark: "#92400e", labelKey: "states.upcoming" },
  occupied: { main: "#c62828", dark: "#7f1d1d", labelKey: "states.occupied" },
};

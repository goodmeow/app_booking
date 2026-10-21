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

// Traffic-light semantics verified on the RK3288 tablet. LED codes are only
// advisory here; the native bridge validates them again before writing sysfs.
export const kioskLedCodes = {
  available: 5,
  awaitingCheckIn: 20,
  occupied: 4,
  offline: 2,
  unknown: null,
};

export const kioskLedCodeFor = (mode) => kioskLedCodes[mode] ?? null;

export const deriveKioskState = (events = [], settings = {}, nowValue = new Date(), { fresh = true } = {}) => {
  const now = nowValue instanceof Date ? nowValue.getTime() : new Date(nowValue).getTime();
  const sorted = [...events]
    .filter((event) => Number.isFinite(new Date(event.start).getTime()) && Number.isFinite(new Date(event.end).getTime()))
    .sort((left, right) => new Date(left.start) - new Date(right.start));
  const current = sorted.find((event) => new Date(event.start).getTime() <= now && now < new Date(event.end).getTime());
  const next = sorted.find((event) => new Date(event.start).getTime() > now) || null;
  if (!fresh) return { mode: "offline", current: null, next };
  if (current) {
    return { mode: current.checkedIn ? "occupied" : "awaitingCheckIn", current, next };
  }
  return { mode: "available", current: null, next };
};

export const kioskPalette = {
  unknown: { main: "#455a64", dark: "#263238", labelKey: "states.unknown" },
  offline: { main: "#455a64", dark: "#263238", labelKey: "states.offline" },
  available: { main: "#44865a", dark: "#2f5c3f", labelKey: "states.available" },
  awaitingCheckIn: { main: "#8a6d00", dark: "#6b5200", labelKey: "states.awaitingCheckIn" },
  occupied: { main: "#c70039", dark: "#7f1d1d", labelKey: "states.occupied" },
};

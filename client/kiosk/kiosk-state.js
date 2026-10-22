import { localeForLanguage } from "../i18n/languages.js";

const pad = (value) => String(value).padStart(2, "0");

// Server membaca tanggal kiosk memakai APP_TIMEZONE-nya. Tablet yang zonanya
// berbeda harus memakai zona yang sama, kalau tidak akan menanyakan hari lain.
const zonedFields = (date, timeZone) => {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
};

export const kioskDayRange = (now = new Date(), timeZone) => {
  const { year, month, day } = zonedFields(now, timeZone);
  const key = `${year}${pad(month)}${pad(day)}`;
  return { start: key, end: key };
};

export const formatKioskTime = (value, timeZone) => {
  const { hour, minute } = zonedFields(value instanceof Date ? value : new Date(value), timeZone);
  return `${pad(hour)}:${pad(minute)}`;
};

export const formatKioskDate = (value, language, timeZone) => new Intl.DateTimeFormat(localeForLanguage(language), {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  ...(timeZone ? { timeZone } : {}),
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

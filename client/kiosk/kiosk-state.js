const pad = (value) => String(value).padStart(2, "0");

export const kioskDayRange = (now = new Date()) => {
  const key = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return { start: key, end: key };
};

export const formatKioskTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatKioskDate = (value) => new Intl.DateTimeFormat("id-ID", {
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
  unknown: { main: "#455a64", dark: "#263238", label: "UNKNOWN" },
  available: { main: "#0b7a53", dark: "#064e3b", label: "AVAILABLE" },
  upcoming: { main: "#d97706", dark: "#92400e", label: "UPCOMING" },
  occupied: { main: "#c62828", dark: "#7f1d1d", label: "OCCUPIED" },
};

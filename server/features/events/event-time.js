import { badRequest } from "../../lib/http-error.js";

const formatterFor = (timezone) => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw badRequest("INVALID_TIMEZONE", "Unsupported IANA timezone");
  }
};

const partsFrom = (value, timezone) => {
  const parts = Object.fromEntries(
    formatterFor(timezone).formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: value.getUTCMilliseconds(),
  };
};

const comparableUtc = (parts) => Date.UTC(
  parts.year,
  parts.month - 1,
  parts.day,
  parts.hour || 0,
  parts.minute || 0,
  parts.second || 0,
  parts.millisecond || 0
);

export const zonedPartsToDate = (parts, timezone) => {
  const desired = comparableUtc(parts);
  let guess = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = comparableUtc(partsFrom(guess, timezone));
    const correction = desired - actual;
    if (correction === 0) return guess;
    guess = new Date(guess.getTime() + correction);
  }
  const finalParts = partsFrom(guess, timezone);
  if (comparableUtc(finalParts) !== desired) throw badRequest("INVALID_LOCAL_TIME", "Local time does not exist in the selected timezone");
  return guess;
};

export const parseInstant = (value, field) => {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw badRequest("INVALID_TIME", `${field} must be an ISO-8601 timestamp string`);
  }
  if (typeof value === "string" && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw badRequest("INVALID_TIME", `${field} must include a UTC or numeric timezone offset`);
  }
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw badRequest("INVALID_TIME", `${field} must be a valid ISO-8601 timestamp`);
  return date;
};

export const zonedParts = (value, timezone) => partsFrom(parseInstant(value, "time"), timezone);

export const addLocalDays = (parts, days) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second, parts.millisecond || 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  };
};

export const isValidLocalDate = ({ year, month, day }) => {
  if (![year, month, day].every(Number.isInteger)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
};

export const localDateKey = (parts) => `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

export const localWeekday = (parts) => new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();

export const daysBetweenLocalDates = (left, right) => Math.round((
  Date.UTC(right.year, right.month - 1, right.day)
  - Date.UTC(left.year, left.month - 1, left.day)
) / 86_400_000);

export const formatLocalTime = (value, timezone) => {
  const parts = partsFrom(parseInstant(value, "time"), timezone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
};

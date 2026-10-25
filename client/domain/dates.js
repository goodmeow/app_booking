import i18n from "../i18n/index.js";
import { localeForLanguage } from "../i18n/languages.js";

const pad = (value) => String(value).padStart(2, "0");

export const currentMonthRange = (now = new Date()) => ({
  start: new Date(now.getFullYear(), now.getMonth(), 1),
  end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
});

export const formatDateDDMMYYYY = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

export const formatDateDDMMMYYYY = (value, language = "en") => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  const month = new Intl.DateTimeFormat(localeForLanguage(language), { month: "short" })
    .format(date)
    .replace(/\.$/, "");
  return `${pad(date.getDate())}-${month}-${date.getFullYear()}`;
};

export const formatDateYYYYMMDD = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatDateLong = (value, language) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return new Intl.DateTimeFormat(localeForLanguage(language), { day: "2-digit", month: "long", year: "numeric" }).format(date);
};

export const formatDateTimeLong = (value, language) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};

export const isValidDateRange = (start, end) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  return !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && startDate <= endDate;
};

export const reportFilename = (start, end, language) => i18n.getFixedT(
  language || i18n.resolvedLanguage || i18n.language || "en",
  "report"
)("workbook.filename", {
  start: formatDateDDMMYYYY(start),
  end: formatDateDDMMYYYY(end),
});

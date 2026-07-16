import { localeForLanguage } from "../i18n/languages.js";

export const canManageProfile = (session, userId) =>
  Boolean(session?.user?._id && userId && session.user._id === userId);

export const formatJoinedDate = (value, language) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: "medium" }).format(date);
};

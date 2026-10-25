import config from "../../../config/config.js";
import { badRequest } from "../../lib/http-error.js";
import { addLocalDays, daysBetweenLocalDates, isValidLocalDate, localDateKey, localWeekday, parseInstant, zonedParts, zonedPartsToDate } from "./event-time.js";

const normalizeRecurrence = (recurrence = {}) => {
  const cadence = String(recurrence.cadence || "").toLowerCase();
  const interval = Number(recurrence.interval || 1);
  const endDate = String(recurrence.endDate || "");
  const weekdays = [...new Set((recurrence.weekdays || []).map(Number))].sort((a, b) => a - b);
  const monthlyPattern = String(recurrence.monthlyPattern || "date").toLowerCase();
  const monthWeekIndex = Number(recurrence.monthWeekIndex || 1);
  const monthWeekday = Number(recurrence.monthWeekday || 0);
  if (!['daily', 'weekly', 'monthly'].includes(cadence)) throw badRequest("INVALID_RECURRENCE", "Cadence must be daily, weekly, or monthly");
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) throw badRequest("INVALID_RECURRENCE", "Recurrence interval must be between 1 and 52");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw badRequest("INVALID_RECURRENCE", "Recurrence end date is required");
  if (cadence === "weekly" && (!weekdays.length || weekdays.some((day) => day < 0 || day > 6))) {
    throw badRequest("INVALID_RECURRENCE", "Weekly recurrence requires weekdays from 0 through 6");
  }
  if (cadence === "monthly" && !["date", "weekday"].includes(monthlyPattern)) {
    throw badRequest("INVALID_RECURRENCE", "Monthly recurrence pattern must be date or weekday");
  }
  if (cadence === "monthly" && monthlyPattern === "weekday") {
    if (![1, 2, 3, 4, -1].includes(monthWeekIndex)) {
      throw badRequest("INVALID_RECURRENCE", "Month weekday index must be 1-4 or -1 for the last occurrence");
    }
    if (!Number.isInteger(monthWeekday) || monthWeekday < 0 || monthWeekday > 6) {
      throw badRequest("INVALID_RECURRENCE", "Monthly weekday recurrence requires a weekday from 0 through 6");
    }
  }
  return { cadence, interval, endDate, weekdays, monthlyPattern, monthWeekIndex, monthWeekday };
};

const daysInLocalMonth = ({ year, month }) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const weeksOfMonth = (day) => Math.floor((day - 1) / 7) + 1;

const isLastWeekOfMonth = (parts) => parts.day + 7 > daysInLocalMonth(parts);

// The "monthly on date" pattern skips months that do not have the same date
// (for example 31 January does not repeat in February).
const monthsFromBase = (base, localStart) => (localStart.year - base.year) * 12 + (localStart.month - base.month);

const monthlyDue = (base, localStart, rule) => {
  if (monthsFromBase(base, localStart) % rule.interval !== 0) return false;
  if (rule.monthlyPattern === "date") return localStart.day === base.day;
  if (localWeekday(localStart) !== rule.monthWeekday) return false;
  return rule.monthWeekIndex === -1
    ? isLastWeekOfMonth(localStart)
    : weeksOfMonth(localStart.day) === rule.monthWeekIndex;
};

export const buildOccurrences = ({ start, end, timezone, recurrence }) => {
  const startInstant = parseInstant(start, "start");
  const endInstant = parseInstant(end, "end");
  const duration = endInstant.getTime() - startInstant.getTime();
  if (duration <= 0) throw badRequest("INVALID_RANGE", "End time must be after start time");
  const rule = normalizeRecurrence(recurrence);
  const base = zonedParts(startInstant, timezone);
  const baseEnd = zonedParts(endInstant, timezone);
  const endDayOffset = daysBetweenLocalDates(base, baseEnd);
  const endDateParts = { ...base };
  const [year, month, day] = rule.endDate.split("-").map(Number);
  Object.assign(endDateParts, { year, month, day });
  if (!isValidLocalDate(endDateParts)) throw badRequest("INVALID_RECURRENCE", "Recurrence end date is invalid");
  const horizonDays = daysBetweenLocalDates(base, endDateParts);
  if (horizonDays < 0 || horizonDays > config.recurrenceMaxDays) {
    throw badRequest("RECURRENCE_LIMIT", `Recurrence horizon must be 0-${config.recurrenceMaxDays} days`);
  }

  const occurrences = [];
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const localStart = addLocalDays(base, offset);
    const due = rule.cadence === "daily"
      ? offset % rule.interval === 0
      : rule.cadence === "weekly"
        ? Math.floor(offset / 7) % rule.interval === 0 && rule.weekdays.includes(localWeekday(localStart))
        : monthlyDue(base, localStart, rule);
    if (!due) continue;
    const occurrenceStart = zonedPartsToDate(localStart, timezone);
    const occurrenceEnd = zonedPartsToDate({
      ...addLocalDays(localStart, endDayOffset),
      hour: baseEnd.hour,
      minute: baseEnd.minute,
      second: baseEnd.second,
    }, timezone);
    if (occurrenceEnd <= occurrenceStart) throw badRequest("INVALID_RECURRENCE", "Recurring occurrence end must follow its start");
    occurrences.push({
      index: occurrences.length,
      start: occurrenceStart.toISOString(),
      end: occurrenceEnd.toISOString(),
      localDate: localDateKey(localStart),
    });
    if (occurrences.length > config.recurrenceMaxOccurrences) {
      throw badRequest("RECURRENCE_LIMIT", `Recurrence cannot exceed ${config.recurrenceMaxOccurrences} occurrences`);
    }
  }
  if (!occurrences.length) throw badRequest("INVALID_RECURRENCE", "Recurrence produces no occurrences");
  return { rule, occurrences };
};

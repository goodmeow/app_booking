import {
  formatDateDDMMYYYY,
  formatDateTimeLong,
} from "./dates.js";
import i18n from "../i18n/index.js";

const activeLanguage = (language) => language || i18n.resolvedLanguage || i18n.language || "en";
const reportTranslator = (language) => i18n.getFixedT(activeLanguage(language), "report");
const XLSX_EXTENSION = /(?:\.xlsx)+$/i;

export const sanitizeWorksheetName = (value) => {
  const name = String(value)
    .replace(/[\u0000-\u001f\u007f*?:\\/\[\]]/g, "")
    .trim()
    .replace(/^'+|'+$/g, "")
    .trim();
  return (name || "Sheet").slice(0, 31);
};

export const sanitizeWorkbookFilename = (value) => {
  const basename = String(value)
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "")
    .trim()
    .replace(XLSX_EXTENSION, "")
    .replace(/[. ]+$/g, "");
  return `${basename || "report"}.xlsx`;
};

export const safeReportText = (value) => (
  value === null || value === undefined || value === "" ? "-" : String(value)
);

export const safeReportDescription = (value) => {
  const description = safeReportText(value);
  if (description === "-") return description;
  try {
    return decodeURIComponent(description);
  } catch (_error) {
    return description;
  }
};

export const formatReportMeetingDate = (value, language) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateTimeLong(date, activeLanguage(language));
};

export const reportMeetingsFor = (room) => (
  Array.isArray(room?.list_meeting) ? room.list_meeting : []
);

export const roomUsageExportRows = (rooms = [], language) => {
  const t = reportTranslator(language);
  const rows = [[t("roomName"), t("roomEmail"), t("workbook.usageTotal")]];
  rooms.forEach((room) => {
    const meetings = reportMeetingsFor(room);
    rows.push(
      [safeReportText(room?.room_name), safeReportText(room?.room_mail), safeReportText(room?.total_pemakaian)],
      [null, t("workbook.history")],
      meetings.length
        ? [null, t("subject"), t("organizer"), t("description"), t("meetingStart"), t("meetingEnd")]
        : [null, t("workbook.noHistory")],
      ...meetings.map((meeting) => [
        null,
        safeReportText(meeting?.subject),
        safeReportText(meeting?.organizer),
        safeReportDescription(meeting?.description),
        formatReportMeetingDate(meeting?.start_date, language),
        formatReportMeetingDate(meeting?.end_date, language),
      ])
    );
  });
  return rows;
};

const dynamicColumnWidths = (rows, count = 6) => Array.from({ length: count }, (_, column) => ({
  width: Math.max(12, ...rows.map((row) => String(row[column] ?? "").length + 2)),
}));

export const buildRoomUsageWorkbook = (XLSX, rooms, start, end, language) => {
  const t = reportTranslator(language);
  const rows = roomUsageExportRows(rooms, language);
  const workbook = new XLSX.Workbook();
  const formattedStart = formatDateDDMMYYYY(new Date(`${start}T00:00:00`));
  const formattedEnd = formatDateDDMMYYYY(new Date(`${end}T00:00:00`));
  const worksheet = workbook.addWorksheet(sanitizeWorksheetName(
    t("workbook.sheet", { start: formattedStart, end: formattedEnd })
  ));
  worksheet.addRows(rows);
  worksheet.columns = dynamicColumnWidths(rows);
  return {
    workbook,
    filename: sanitizeWorkbookFilename(
      t("workbook.filename", { start: formattedStart, end: formattedEnd })
    ),
  };
};

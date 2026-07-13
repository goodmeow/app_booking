import {
  formatDateDDMMYYYY,
  formatDateTimeLong,
  reportFilename,
} from "./dates.js";

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

export const formatReportMeetingDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateTimeLong(date);
};

export const reportMeetingsFor = (room) => (
  Array.isArray(room?.list_meeting) ? room.list_meeting : []
);

export const roomUsageExportRows = (rooms = []) => {
  const rows = [["Room Name", "Room Mail", "Usage Total"]];
  rooms.forEach((room) => {
    const meetings = reportMeetingsFor(room);
    rows.push(
      [safeReportText(room?.room_name), safeReportText(room?.room_mail), safeReportText(room?.total_pemakaian)],
      [null, "History Pemakaian"],
      meetings.length
        ? [null, "Subject", "Organizer", "Description", "Start Date", "End Date"]
        : [null, "No History Meeting"],
      ...meetings.map((meeting) => [
        null,
        safeReportText(meeting?.subject),
        safeReportText(meeting?.organizer),
        safeReportDescription(meeting?.description),
        formatReportMeetingDate(meeting?.start_date),
        formatReportMeetingDate(meeting?.end_date),
      ])
    );
  });
  return rows;
};

const dynamicColumnWidths = (rows, count = 6) => Array.from({ length: count }, (_, column) => ({
  width: Math.max(12, ...rows.map((row) => String(row[column] ?? "").length + 2)),
}));

export const buildRoomUsageWorkbook = (XLSX, rooms, start, end) => {
  const rows = roomUsageExportRows(rooms);
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = dynamicColumnWidths(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    `Periode ${formatDateDDMMYYYY(new Date(`${start}T00:00:00`))} - ${formatDateDDMMYYYY(new Date(`${end}T00:00:00`))}`
  );
  return {
    workbook,
    filename: reportFilename(new Date(`${start}T00:00:00`), new Date(`${end}T00:00:00`)),
  };
};

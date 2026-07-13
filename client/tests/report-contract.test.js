import assert from "node:assert/strict";
import test from "node:test";
import { buildRoomUsageWorkbook, roomUsageExportRows } from "../domain/report.js";

class Workbook {
  constructor() { this.sheets = []; }
  addWorksheet(name) {
    const worksheet = { name, rows: [], columns: [], addRows(rows) { this.rows.push(...rows); } };
    this.sheets.push(worksheet);
    return worksheet;
  }
}
const XLSX = { Workbook };

const rooms = [{
  room_name: "Meeting Room One",
  room_mail: "meeting-one@room.com",
  total_pemakaian: 1,
  list_meeting: [{
    subject: "Quarterly planning",
    organizer: "owner@example.test",
    description: "Budget%20%2B%20schedule",
    start_date: "2030-01-15T09:00:00.000Z",
    end_date: "2030-01-15T10:00:00.000Z",
  }],
}];

test("builds the recovered report row matrix and decodes descriptions", () => {
  const rows = roomUsageExportRows(rooms);
  assert.deepEqual(rows[0], ["Room Name", "Room Mail", "Usage Total"]);
  assert.deepEqual(rows[1], ["Meeting Room One", "meeting-one@room.com", "1"]);
  assert.deepEqual(rows[3], [null, "Subject", "Organizer", "Description", "Start Date", "End Date"]);
  assert.equal(rows[4][3], "Budget + schedule");
});

test("builds recovered workbook name, sheet, and dynamic widths", () => {
  const { workbook, filename } = buildRoomUsageWorkbook(XLSX, rooms, "2030-01-01", "2030-01-31");
  assert.equal(filename, "History Meeting Report (01-01-2030 - 31-01-2030).xlsx");
  const worksheet = workbook.sheets[0];
  assert.equal(worksheet.name, "Periode 01-01-2030 - 31-01-2030");
  assert.equal(worksheet.rows[1][0], "Meeting Room One");
  assert.equal(worksheet.rows[4][3], "Budget + schedule");
  assert.equal(worksheet.columns.length, 6);
  assert.ok(worksheet.columns[1].width >= "meeting-one@room.com".length);
});

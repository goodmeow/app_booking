import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { buildRoomUsageWorkbook, roomUsageExportRows } from "../domain/report.js";

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
  assert.deepEqual(workbook.SheetNames, ["Periode 01-01-2030 - 31-01-2030"]);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  assert.equal(worksheet.A2.v, "Meeting Room One");
  assert.equal(worksheet.D5.v, "Budget + schedule");
  assert.equal(worksheet["!cols"].length, 6);
  assert.ok(worksheet["!cols"][1].width >= "meeting-one@room.com".length);
});

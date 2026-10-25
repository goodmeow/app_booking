// Minimal RFC-4180-ish CSV parser for the bulk user import. It supports quoted
// fields, commas inside quotes, escaped quotes, and CRLF. No dependency needed.
const parseRecords = (input) => {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  const text = String(input ?? "").replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
};

const normalizeHeader = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, "_");

const HEADER_ALIASES = {
  employee_id: "employee_id",
  employeeid: "employee_id",
  employee: "employee_id",
  name: "name",
  email: "email",
  role: "role",
  floor: "floor",
  card_number: "card_number",
  card: "card_number",
};

export const parseUserCsv = (input) => {
  const records = parseRecords(input).filter((record) => record.some((cell) => String(cell).trim() !== ""));
  if (!records.length) throw new Error("CSV is empty");

  const headers = records[0].map(normalizeHeader);
  const mapped = headers.map((header) => HEADER_ALIASES[header] || header);
  const required = ["employee_id", "name", "email"];
  const missing = required.filter((field) => !mapped.includes(field));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);

  const rows = records.slice(1).map((record, index) => {
    const row = {};
    mapped.forEach((key, position) => {
      row[key] = String(record[position] ?? "").trim();
    });
    row.__line = index + 2;
    return row;
  });
  if (!rows.length) throw new Error("CSV has no data rows");
  return rows;
};

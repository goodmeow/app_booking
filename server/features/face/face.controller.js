import { query } from "../../db/pool.js";
import { fetchFaceTemplates, fetchFaceVerifyLog, probeFaceService } from "./face.client.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

const readPage = (input) => {
  const limit = Math.min(Math.max(Number(input.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(input.offset) || 0, 0);
  return { limit, offset };
};

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

// The face service only knows employee_id. Names stay in app_booking, so the
// proxy joins them here instead of reaching into tbl_users from the service.
const attachNames = async (rows) => {
  const employeeIds = [...new Set(rows.map((row) => row.employee_id).filter(Boolean))];
  if (employeeIds.length === 0) return rows;

  const result = await query(
    `SELECT lower(btrim(employee_id)) AS employee_id, name
   FROM tbl_users
   WHERE lower(btrim(employee_id)) = ANY($1::text[])`,
    [employeeIds.map((employeeId) => String(employeeId).toLowerCase())],
  );
  const names = new Map(result.rows.map((row) => [row.employee_id, row.name]));

  return rows.map((row) => ({
    ...row,
    name: names.get(String(row.employee_id || "").toLowerCase()) || null,
  }));
};

export const faceStatus = run(async (_req, res) => {
  res.json(await probeFaceService());
});

export const listTemplates = run(async (req, res) => {
  const { limit, offset } = readPage(req.query);
  const listing = await fetchFaceTemplates({ limit, offset });
  res.json({
    available: true,
    templates: await attachNames(listing.templates || []),
    total: Number(listing.total || 0),
  });
});

export const listVerifyLog = run(async (req, res) => {
  const { limit, offset } = readPage(req.query);
  const result = typeof req.query.result === "string" ? req.query.result : undefined;
  const listing = await fetchFaceVerifyLog({ result, limit, offset });
  res.json({
    available: true,
    entries: await attachNames(listing.entries || []),
    total: Number(listing.total || 0),
  });
});

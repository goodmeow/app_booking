import { query, withTransaction } from "../../db/pool.js";
import { badRequest, conflict, forbidden } from "../../lib/http-error.js";
import { createUser, editUser } from "./user.service.js";
import { isAdminRole } from "../../lib/roles.js";

const MAX_ROWS = 500;
const DEFAULT_PASSWORD = "123456Ab";

// Two concurrent imports must not both demote the last two admins, so the
// remaining admin rows stay locked until the demotion commits.
const refuseLastAdminDemotion = async (execute, adminRoleId) => {
  const admins = await execute(
    `SELECT _id
     FROM tbl_users
     WHERE role_id = $1
       AND is_deleted IS NOT TRUE
     ORDER BY _id
     FOR UPDATE`,
    [adminRoleId],
  );
  if (admins.rows.length <= 1) {
    throw conflict("LAST_ADMIN", "Cannot demote the last active admin");
  }
};

// CSV import may assign the normal admin and front-desk roles, never the
// protected super admin role created by /setup.
const IMPORTABLE_ROLES = ["admin", "receptionist", "user"];

const roleMap = async () => {
  const rows = await query(
    `SELECT _id, lower(role_name) AS name
     FROM tbl_role
     WHERE is_deleted IS NOT TRUE
       AND lower(role_name) = ANY($1::text[])`,
    [IMPORTABLE_ROLES],
  );
  return new Map(rows.rows.map((row) => [row.name, row._id]));
};

// One query for the whole file instead of one lookup per row.
const existingEmployees = async () => {
  const rows = await query(
    `SELECT _id, lower(btrim(employee_id)) AS key, role_id
     FROM tbl_users
     WHERE type = 'employee'
       AND is_deleted IS NOT TRUE
       AND coalesce(btrim(employee_id), '') <> ''`,
  );
  return new Map(rows.rows.map((row) => [row.key, row]));
};

const text = (value) => String(value ?? "").trim();

export const importUsers = async ({ rows, mode = "skip" }, principal) => {
  if (!isAdminRole(principal?.role)) throw forbidden();
  if (!Array.isArray(rows) || !rows.length) throw badRequest("INVALID_IMPORT", "The CSV has no data rows");
  if (rows.length > MAX_ROWS) throw badRequest("INVALID_IMPORT", `Maximum ${MAX_ROWS} rows per import`);
  if (!["skip", "overwrite"].includes(mode)) throw badRequest("INVALID_IMPORT", "Mode must be skip or overwrite");

  const roles = await roleMap();
  const existing = await existingEmployees();
  const seen = new Set();
  const result = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  // The whole file is one unit of work, but a bad row must not discard the
  // good ones: each row runs in its own savepoint.
  await withTransaction(async (client) => {
    const execute = (text, params) => client.query(text, params);

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = index + 2;
      const employeeId = text(row.employee_id);

      await execute("SAVEPOINT import_row");
      try {
        const key = employeeId.toLowerCase();
        if (!key) throw badRequest("INVALID_EMPLOYEE_ID", "employee_id is required");
        if (seen.has(key)) throw badRequest("DUPLICATE_EMPLOYEE_ID", "employee_id appears more than once in the file");
        seen.add(key);

        const name = text(row.name);
        const email = text(row.email);
        if (!name || !email) throw badRequest("INVALID_USER", "name and email are required");
        // A missing floor column means "leave the current floor alone"; an empty
        // cell in an existing floor column means "clear the floor".
        const floor = Object.hasOwn(row, "floor") ? text(row.floor) : undefined;

        const existingRow = existing.get(key) || null;
        const requestedRole = text(row.role).toLowerCase();
        const roleId = requestedRole ? roles.get(requestedRole) : existingRow?.role_id || roles.get("user");
        if (!roleId) throw badRequest("INVALID_ROLE", `Unknown role: ${row.role}`);

        if (existingRow) {
          if (mode !== "overwrite") {
            result.skipped += 1;
          } else {
            const adminRoleId = roles.get("admin");
            if (existingRow.role_id === adminRoleId && roleId !== adminRoleId) {
              await refuseLastAdminDemotion(execute, adminRoleId);
            }
            await editUser(
              existingRow._id,
              {
                name,
                email,
                employee_id: employeeId,
                roleId,
                ...(floor !== undefined ? { floor } : {}),
                ...(text(row.card_number) ? { card_number: text(row.card_number) } : {}),
              },
              principal,
              { execute },
            );
            result.updated += 1;
          }
        } else {
          await createUser(
            {
              name,
              email,
              employee_id: employeeId,
              roleId,
              ...(floor !== undefined ? { floor } : {}),
              password: DEFAULT_PASSWORD,
              must_change_password: true,
              ...(text(row.card_number) ? { card_number: text(row.card_number) } : {}),
            },
            principal,
            { execute },
          );
          result.created += 1;
        }
        await execute("RELEASE SAVEPOINT import_row");
      } catch (error) {
        await execute("ROLLBACK TO SAVEPOINT import_row");
        result.failed += 1;
        result.errors.push({
          row: rowNumber,
          employee_id: employeeId,
          code: error.code || "IMPORT_ROW_FAILED",
          message: error.message || "Import failed",
        });
      }
    }
  });

  return result;
};

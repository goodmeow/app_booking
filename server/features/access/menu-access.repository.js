import { query, withTransaction } from "../../db/pool.js";

// These keys are the CMS menus a role may open. The order is the order the
// matrix shows in Settings.
export const MENU_KEYS = ["calendar", "report", "users", "rooms", "devices", "settings"];

// super_admin is fixed at full access and is not editable from the matrix.
export const MATRIX_ROLES = ["super_admin", "admin", "receptionist", "user"];

const roleOrder = `CASE lower(r.role_name)
  WHEN 'super_admin' THEN 0
  WHEN 'admin' THEN 1
  WHEN 'receptionist' THEN 2
  WHEN 'user' THEN 3
  ELSE 4
END`;

export const listMenuAccess = async (execute = query) => (await execute(
  `SELECT
     r._id AS role_id,
     lower(r.role_name) AS role_name,
     m.menu_key,
     COALESCE(a.allowed, false) AS allowed
   FROM tbl_role r
   CROSS JOIN unnest($1::text[]) AS m(menu_key)
   LEFT JOIN tbl_role_menu_access a
     ON a.role_id = r._id
    AND a.menu_key = m.menu_key
   WHERE r.is_deleted IS NOT TRUE
     AND lower(r.role_name) = ANY($2::text[])
   ORDER BY ${roleOrder}, array_position($1::text[], m.menu_key)`,
  [MENU_KEYS, MATRIX_ROLES]
)).rows;

export const allowedMenusForRole = async (roleName, execute = query) => (await execute(
  `SELECT m.menu_key
   FROM tbl_role r
   CROSS JOIN unnest($1::text[]) AS m(menu_key)
   JOIN tbl_role_menu_access a
     ON a.role_id = r._id
    AND a.menu_key = m.menu_key
    AND a.allowed IS TRUE
   WHERE r.is_deleted IS NOT TRUE
     AND lower(r.role_name) = lower($2)
   ORDER BY array_position($1::text[], m.menu_key)`,
  [MENU_KEYS, roleName]
)).rows.map((row) => row.menu_key);

export const roleAllowsMenu = async (roleName, menuKey) => {
  const rows = await allowedMenusForRole(roleName);
  return rows.includes(menuKey);
};

// The caller validates entries first; this only writes the rows it was given.
export const saveMenuAccess = async (entries) => withTransaction(async (client) => {
  const execute = (text, values) => client.query(text, values);
  const roles = await execute(
    `SELECT _id, lower(role_name) AS role_name
     FROM tbl_role
     WHERE is_deleted IS NOT TRUE
       AND lower(role_name) = ANY($1::text[])`,
    [MATRIX_ROLES]
  );
  const roleIds = new Map(roles.rows.map((role) => [role.role_name, role._id]));

  for (const entry of entries) {
    const roleId = roleIds.get(entry.role_name);
    if (!roleId || entry.role_name === "super_admin") continue;
    await execute(
      `INSERT INTO tbl_role_menu_access (role_id, menu_key, allowed, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (role_id, menu_key) DO UPDATE
       SET allowed = EXCLUDED.allowed,
           updated_at = now()`,
      [roleId, entry.menu_key, entry.allowed]
    );
  }

  // A super admin always keeps full access, even if a previous version or a
  // manual database edit left a gap.
  const superAdminId = roleIds.get("super_admin");
  if (superAdminId) {
    for (const menuKey of MENU_KEYS) {
      await execute(
        `INSERT INTO tbl_role_menu_access (role_id, menu_key, allowed, updated_at)
         VALUES ($1, $2, true, now())
         ON CONFLICT (role_id, menu_key) DO UPDATE
         SET allowed = true,
             updated_at = now()`,
        [superAdminId, menuKey]
      );
    }
  }

  return listMenuAccess(execute);
});

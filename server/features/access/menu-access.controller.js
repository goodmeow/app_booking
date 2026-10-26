import { badRequest } from "../../lib/http-error.js";
import { isSuperAdminRole } from "../../lib/roles.js";
import { allowedMenusForRole, listMenuAccess, MATRIX_ROLES, MENU_KEYS, saveMenuAccess } from "./menu-access.repository.js";

const matrixPayload = (rows) => ({
  menus: MENU_KEYS,
  roles: MATRIX_ROLES.map((roleName) => ({
    role_name: roleName,
    role_id: rows.find((row) => row.role_name === roleName)?.role_id || null,
  })),
  access: rows.map(({ role_name, menu_key, allowed }) => ({ role_name, menu_key, allowed })),
});

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

export const myMenus = run(async (req, res) => {
  const menus = isSuperAdminRole(req.auth.role)
    ? MENU_KEYS
    : await allowedMenusForRole(req.auth.role);
  res.json({ menus, role: req.auth.role, super_admin: isSuperAdminRole(req.auth.role) });
});

export const readMatrix = run(async (_req, res) => {
  res.json(matrixPayload(await listMenuAccess()));
});

export const updateMatrix = run(async (req, res) => {
  const access = req.body?.access;
  if (!Array.isArray(access)) throw badRequest("INVALID_MENU_ACCESS", "access must be an array");

  const entries = access.map((entry) => {
    const roleName = String(entry?.role_name || "").toLowerCase();
    const menuKey = String(entry?.menu_key || "");
    if (!MATRIX_ROLES.includes(roleName) || roleName === "super_admin") {
      throw badRequest("INVALID_MENU_ACCESS", "Only admin, receptionist, and user may be changed");
    }
    if (!MENU_KEYS.includes(menuKey)) {
      throw badRequest("INVALID_MENU_ACCESS", `Unknown menu: ${menuKey}`);
    }
    if (typeof entry.allowed !== "boolean") {
      throw badRequest("INVALID_MENU_ACCESS", "allowed must be a boolean");
    }
    return { role_name: roleName, menu_key: menuKey, allowed: entry.allowed };
  });

  res.json(matrixPayload(await saveMenuAccess(entries)));
});

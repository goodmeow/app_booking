import { ROLE_IDS, ROLE_LABELS, ROLE_OPTIONS } from "../../domain/roles.js";
import { hasFloor } from "../user-form.js";

// The role filter needs a value that can never collide with a role id.
export const ROLE_FILTER_ALL = "all";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const searchableText = (user) => [user?.name, user?.email, user?.employee_id]
  .map((value) => String(value ?? "").toLowerCase())
  .join(" ");

// The filter also offers the fixed super admin, while the user form only
// offers the assignable roles.
export const ROLE_FILTER_OPTIONS = [
  { value: ROLE_IDS.SUPER_ADMIN, labelKey: ROLE_LABELS[ROLE_IDS.SUPER_ADMIN] },
  ...ROLE_OPTIONS,
];

// Role chip text; an unknown role id returns "" so the grid can show "-".
export const roleLabel = (t, roleId) => {
  const labelKey = ROLE_LABELS[roleId];
  return labelKey ? t(`common:${labelKey}`) : "";
};

// Search, role, and the missing-floor shortcut are combined with AND so the
// admin can narrow the list from several directions at once.
export const filterUsers = (users, {
  search = "",
  roleId = ROLE_FILTER_ALL,
  onlyMissingFloor = false,
} = {}) => {
  const needle = normalizeText(search);
  return (Array.isArray(users) ? users : []).filter((user) => {
    if (onlyMissingFloor && hasFloor(user)) return false;
    if (roleId !== ROLE_FILTER_ALL && user?.role_id !== roleId) return false;
    if (!needle) return true;
    return searchableText(user).includes(needle);
  });
};

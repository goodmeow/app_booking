export const ROLE_IDS = {
  SUPER_ADMIN: "a1e5d7c9-2b64-4f38-9a10-7c3d5e8f6b21",
  ADMIN: "471ba030-c950-41f9-90da-4e0fe10426a6",
  RECEPTIONIST: "3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73",
  USER: "67e9500b-908a-497d-9d3b-54bc020700cb",
};

// A role label exists for every role, including the fixed super admin. The
// form only offers the assignable roles below.
export const ROLE_LABELS = {
  [ROLE_IDS.SUPER_ADMIN]: "roles.superAdmin",
  [ROLE_IDS.ADMIN]: "roles.admin",
  [ROLE_IDS.RECEPTIONIST]: "roles.receptionist",
  [ROLE_IDS.USER]: "roles.user",
};

// Order follows the capability ladder: admin, then the front-desk role that may
// book on behalf of an employee, then the regular employee.
export const ROLE_OPTIONS = [
  { value: ROLE_IDS.ADMIN, labelKey: "roles.admin" },
  { value: ROLE_IDS.RECEPTIONIST, labelKey: "roles.receptionist" },
  { value: ROLE_IDS.USER, labelKey: "roles.user" },
];

// The session carries the role name ("ADMIN", "RECEPTIONIST", "USER"), while
// the user form carries the role id. Both are normalised to upper case here so
// callers can pass either.
const normalizedRole = (role) => String(role ?? "").trim().toUpperCase();

export const isAdminRole = (role) => ["ADMIN", "SUPER_ADMIN"].includes(normalizedRole(role));

export const isSuperAdminRole = (role) => normalizedRole(role) === "SUPER_ADMIN";

export const isReceptionistRole = (role) => normalizedRole(role) === "RECEPTIONIST";

// The schedule scope the calendar opens with: an admin starts on the full
// schedule, everyone else starts on their own meetings and can switch to a room.
export const defaultScheduleModeForRole = (role) => {
  if (isAdminRole(role)) return "all";
  return "mine";
};

// Only the front desk and the admin may create a booking for another employee
// (the server rejects everyone else with 403 FORBIDDEN).
export const canBookForEmployees = (role) => isAdminRole(role) || isReceptionistRole(role);

// `floors` is the current list; `floor` is kept for old sessions and rows.
export const effectiveFloorsList = ({ floor, floors } = {}) => {
  const list = Array.isArray(floors) ? floors.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
  if (list.length) return [...new Set(list.map((item) => item.toLowerCase()))];
  const legacy = String(floor ?? "").trim();
  return legacy ? [legacy.toLowerCase()] : [];
};

// Admins and the floor group "all" (for example the front desk or staff who
// really do work across floors) reach every room. Everyone else is limited to
// their own work floors.
export const canUseAllFloors = ({ role, floor, floors, isAdmin = false } = {}) =>
  Boolean(isAdmin) || isAdminRole(role) || effectiveFloorsList({ floor, floors }).includes("all");

// A receptionist may only book rooms on their floors; admins and regular
// employees keep the list the calendar already prepared for them.
export const roomsForRole = (rooms, { role, floor, floors, isAdmin = false } = {}) => {
  const list = Array.isArray(rooms) ? rooms : [];
  if (canUseAllFloors({ role, floor, floors, isAdmin })) return list;
  const allowed = new Set(effectiveFloorsList({ floor, floors }));
  if (!allowed.size) return [];
  return list.filter((room) => allowed.has(String(room?.floor ?? "").trim().toLowerCase()));
};

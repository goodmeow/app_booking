export const ROLE_IDS = {
  ADMIN: "471ba030-c950-41f9-90da-4e0fe10426a6",
  RECEPTIONIST: "3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73",
  USER: "67e9500b-908a-497d-9d3b-54bc020700cb",
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

export const isAdminRole = (role) => normalizedRole(role) === "ADMIN";

export const isReceptionistRole = (role) => normalizedRole(role) === "RECEPTIONIST";

// The schedule scope the calendar opens with: an admin sees every floor, the
// front desk opens on its own floor, and an employee opens on their own
// meetings.
export const defaultScheduleModeForRole = (role) => {
  if (normalizedRole(role) === "ADMIN") return "all";
  if (isReceptionistRole(role)) return "floor";
  return "mine";
};

// Only the front desk and the admin may create a booking for another employee
// (the server rejects everyone else with 403 FORBIDDEN).
export const canBookForEmployees = (role) => isAdminRole(role) || isReceptionistRole(role);

// Admins and the floor group "all" (for example the front desk or staff who
// really do work across floors) reach every room. Everyone else is limited to
// the rooms of their own work floor.
export const canUseAllFloors = ({ role, floor, isAdmin = false } = {}) =>
  Boolean(isAdmin) || isAdminRole(role) || String(floor ?? "").trim().toLowerCase() === "all";

// A receptionist may only book rooms on their own floor; admins and regular
// employees keep the list the calendar already prepared for them.
export const roomsForRole = (rooms, { role, floor, isAdmin = false } = {}) => {
  const list = Array.isArray(rooms) ? rooms : [];
  if (canUseAllFloors({ role, floor, isAdmin })) return list;
  const ownFloor = String(floor ?? "").trim();
  if (!ownFloor) return [];
  return list.filter((room) => String(room?.floor ?? "").trim() === ownFloor);
};

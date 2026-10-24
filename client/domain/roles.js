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

// Only the front desk and the admin may create a booking for another employee
// (the server rejects everyone else with 403 FORBIDDEN).
export const canBookForEmployees = (role) => isAdminRole(role) || isReceptionistRole(role);

// A receptionist may only book rooms on their own floor; admins and regular
// employees keep the list the calendar already prepared for them.
export const roomsForRole = (rooms, { role, floor } = {}) => {
  const list = Array.isArray(rooms) ? rooms : [];
  if (!isReceptionistRole(role)) return list;
  const ownFloor = String(floor ?? "").trim();
  return list.filter((room) => String(room?.floor ?? "").trim() === ownFloor);
};

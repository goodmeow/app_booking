import { ROLE_IDS } from "../domain/roles.js";

export const createEmptyUserForm = () => ({
  name: "",
  email: "",
  username: "",
  password: "",
  employee_id: "",
  card_number: "",
  master_card: false,
  must_change_password: false,
  floor: "",
  floors: [],
  roleId: ROLE_IDS.USER,
});

// An empty or whitespace-only floor counts as not filled in.
export const hasFloor = (user) =>
  (Array.isArray(user?.floors) && user.floors.some((floor) => String(floor ?? "").trim() !== ""))
  || String(user?.floor ?? "").trim() !== "";

export const EMPLOYEE_ID_MAX_LENGTH = 40;

// Employee IDs are typed by admins: letters, digits, dashes, and underscores,
// at most 40 characters. The server enforces the same rule on create and edit.
export const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;

// Returns the management locale key of the problem, or null when the value is
// acceptable. The dialog shows the key both inline and after a failed submit.
export const employeeIdErrorKey = (value) => {
  const employeeId = String(value ?? "").trim();
  if (!employeeId) return "users.employeeIdRequired";
  if (!EMPLOYEE_ID_PATTERN.test(employeeId)) return "users.employeeIdInvalid";
  return null;
};

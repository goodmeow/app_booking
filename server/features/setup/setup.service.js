import bcrypt from "bcrypt";
import { withTransaction } from "../../db/pool.js";
import { badRequest, conflict } from "../../lib/http-error.js";
import { normalizedEmail, validatedPassword } from "../accounts/identity.validation.js";
import { identityConflictCode, normalizedEmployeeId } from "../users/user.service.js";
import {
  findSuperAdminRoleId,
  getSetupState,
  insertDefaultSettings,
  insertFirstAdmin,
  lockSetup,
  markSetupCompleted,
} from "./setup.repository.js";

// Used when the operator leaves the employee ID empty on the setup form.
export const DEFAULT_ADMIN_EMPLOYEE_ID = "ADMIN-001";

// Setup is still needed only while the flag is unset and no privileged
// account exists. The account check keeps an installation whose seed (or a
// manual import) created an admin before the flag was written from exposing the
// bootstrap form again.
export const setupRequired = ({ setup_completed: setupCompleted, has_admin: hasAdmin } = {}) =>
  setupCompleted !== true && hasAdmin !== true;

export const normalizedSetupBody = (body = {}) => {
  const name = String(body.name ?? "").trim();
  if (!name) throw badRequest("INVALID_SETUP", "Name is required");
  const email = normalizedEmail(body.email);
  const password = validatedPassword(body.password);
  const employeeId = normalizedEmployeeId(body.employeeId ?? body.employee_id) || DEFAULT_ADMIN_EMPLOYEE_ID;
  return { name, email, password, employeeId };
};

const mapSetupError = (error) => {
  const code = identityConflictCode(error);
  if (!code) throw error;
  const message = code === "EMPLOYEE_ID_EXISTS" ? "Employee ID already exists" : "Email already exists";
  throw conflict(code, message);
};

export const readSetupStatus = async () => {
  const state = await getSetupState();
  return { required: setupRequired(state) };
};

export const completeSetup = async (body) => {
  const values = normalizedSetupBody(body);
  const passwordHash = await bcrypt.hash(values.password, 12);
  try {
    const user = await withTransaction(async (client) => {
      const execute = (text, params) => client.query(text, params);
      await lockSetup(execute);
      if (!setupRequired(await getSetupState(execute))) {
        throw conflict("SETUP_COMPLETED", "Initial setup is already completed");
      }
      const roleId = await findSuperAdminRoleId(execute);
      if (!roleId) {
        throw badRequest("SUPER_ADMIN_ROLE_MISSING", "The super admin role is not configured; run the migrations before setup");
      }
      const created = await insertFirstAdmin({
        name: values.name,
        email: values.email,
        passwordHash,
        employeeId: values.employeeId,
        roleId,
      }, execute);
      await insertDefaultSettings(execute);
      await markSetupCompleted(execute);
      return created;
    });
    return { _id: user._id, name: user.name, email: user.email, role: "SUPER_ADMIN" };
  } catch (error) {
    mapSetupError(error);
  }
};

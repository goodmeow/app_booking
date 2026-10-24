import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../../../config/config.js";
import { badRequest, HttpError } from "../../lib/http-error.js";
import { normalizedEmail, normalizedUsername, validatedPassword } from "../accounts/identity.validation.js";
import { createEmployeeAccount, findActivePrincipalById, findPrincipalByLogin, hasDoorCard } from "./auth.repository.js";
import { getSelfSignupEnabled } from "../settings/setting.repository.js";

export const publicPrincipal = (principal) => ({
  _id: principal._id,
  name: principal.name,
  email: principal.email,
  username: principal.username || null,
  type: principal.type,
  floor: principal.floor || null,
  role: String(principal.role || "user").toUpperCase(),
  mustChangePassword: principal.must_change_password === true,
});

export const authenticateCredentials = async (login, password) => {
  if (!login || !password) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid login or password");
  const principal = await findPrincipalByLogin(String(login).trim());
  const valid = principal
    && principal.is_deleted !== true
    && principal.type === "employee"
    && principal.role
    && principal.password
    && await bcrypt.compare(String(password), principal.password);
  if (!valid) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid login or password");
  return principal;
};

export const signPrincipalToken = (principal) => jwt.sign(
  { email: principal.email, name: principal.name, role: String(principal.role).toUpperCase() },
  config.jwtSecret,
  {
    algorithm: "HS256",
    subject: String(principal._id),
    expiresIn: config.jwtExpiry,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  }
);

export const verifyPrincipalToken = async (token) => {
  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
  } catch {
    throw new HttpError(401, "INVALID_TOKEN", "Authentication required");
  }
  const principal = await findActivePrincipalById(claims.sub || claims._id);
  if (!principal || !principal.role) throw new HttpError(401, "INACTIVE_PRINCIPAL", "Authentication required");
  return publicPrincipal(principal);
};

// Public registration is a switch, not a permanent route: the admin can turn it
// off in Management > Settings, and the endpoint must refuse even when the CMS
// link is hidden.
export const signupAllowed = (enabled) => enabled === true;

export const registerEmployee = async ({ name, email, username, password }) => {
  if (!signupAllowed(await getSelfSignupEnabled())) {
    throw new HttpError(403, "SIGNUP_DISABLED", "Self signup is disabled");
  }
  const cleanName = String(name || "").trim();
  if (!cleanName) throw badRequest("INVALID_SIGNUP", "Name is required");
  const cleanEmail = normalizedEmail(email);
  const cleanUsername = normalizedUsername(username);
  const cleanPassword = validatedPassword(password);
  try {
    return await createEmployeeAccount({
      name: cleanName,
      email: cleanEmail,
      username: cleanUsername,
      password: await bcrypt.hash(cleanPassword, 12),
    });
  } catch (error) {
    if (error.code === "23505") throw new HttpError(409, "IDENTITY_EXISTS", "Email or username already exists");
    throw error;
  }
};

export const validateDoorCard = async (cardNumber) => {
  if (!cardNumber || !(await hasDoorCard(String(cardNumber).trim()))) {
    throw badRequest("INVALID_CARD", "Card number not found");
  }
};

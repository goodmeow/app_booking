import { forbidden, HttpError } from "../lib/http-error.js";
import { isSuperAdminRole } from "../lib/roles.js";
import { verifyPrincipalToken } from "../features/auth/auth.service.js";
import { roleAllowsMenu } from "../features/access/menu-access.repository.js";

export const bearerToken = (authorization = "") => {
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] || null;
};

export const requireSignin = async (req, res, next) => {
  try {
    const token = bearerToken(req.get("Authorization"));
    if (!token) throw new HttpError(401, "AUTH_REQUIRED", "Authentication required");
    req.auth = await verifyPrincipalToken(token);
    if (req.auth.mustChangePassword && !passwordChangeAllowed(req)) {
      throw new HttpError(
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Change the default password before using the application"
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};

// The gate only lets the two endpoints needed to leave it through: changing the
// password itself and signing out. Everything else waits for the new password.
const passwordChangeAllowed = (req) => {
  const path = String(req.originalUrl || "").split("?")[0].replace(/\/+$/, "");
  if (req.method === "PUT" && path === "/api/users/change-password") return true;
  if (req.method === "GET" && path === "/api/auth/signout") return true;
  return false;
};

export const superAdminOnly = (req, res, next) => {
  if (!isSuperAdminRole(req.auth?.role)) return next(forbidden("Super administrator access required"));
  next();
};

// Menu access is the configurable layer on top of the role name. A super admin
// bypasses the matrix; every other role needs the row allowed in Settings.
export const menuAccess = (menuKey) => async (req, res, next) => {
  try {
    if (isSuperAdminRole(req.auth?.role) || await roleAllowsMenu(req.auth?.role, menuKey)) {
      return next();
    }
    next(forbidden(`Menu access required: ${menuKey}`));
  } catch (error) {
    next(error);
  }
};

// Self-service stays open, but changing someone else needs the matching menu.
export const selfOrMenu = (menuKey, param = "userId") => async (req, res, next) => {
  if (String(req.auth?._id) === String(req.params[param])) return next();
  return menuAccess(menuKey)(req, res, next);
};

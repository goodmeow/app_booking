import { forbidden, HttpError } from "../lib/http-error.js";
import { verifyPrincipalToken } from "../features/auth/auth.service.js";

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

export const adminOnly = (req, res, next) => {
  if (req.auth?.role !== "ADMIN") return next(forbidden("Administrator access required"));
  next();
};

export const selfOrAdmin = (param = "userId") => (req, res, next) => {
  if (req.auth?.role === "ADMIN" || String(req.auth?._id) === String(req.params[param])) return next();
  next(forbidden());
};

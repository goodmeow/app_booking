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
    next();
  } catch (error) {
    next(error);
  }
};

export const adminOnly = (req, res, next) => {
  if (req.auth?.role !== "ADMIN") return next(forbidden("Administrator access required"));
  next();
};

export const selfOrAdmin = (param = "userId") => (req, res, next) => {
  if (req.auth?.role === "ADMIN" || String(req.auth?._id) === String(req.params[param])) return next();
  next(forbidden());
};

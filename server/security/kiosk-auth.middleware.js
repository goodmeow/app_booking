import { bearerToken } from "./auth.middleware.js";
import { HttpError } from "../lib/http-error.js";
import { verifyKioskToken } from "../features/kiosk/kiosk.service.js";

export const requireKiosk = async (req, res, next) => {
  try {
    const token = bearerToken(req.get("Authorization"));
    if (!token) throw new HttpError(401, "KIOSK_AUTH_REQUIRED", "Kiosk authentication required");
    req.kiosk = await verifyKioskToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

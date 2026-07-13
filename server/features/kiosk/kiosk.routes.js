import express from "express";
import { adminOnly, requireSignin } from "../../security/auth.middleware.js";
import { fixedWindowRateLimit } from "../../security/rate-limit.middleware.js";
import { requireKiosk } from "../../security/kiosk-auth.middleware.js";
import { checkIn, context, deprovision, devices, earlyFinish, refresh, revokeDevice, schedule, signin, updateDeviceCapabilities } from "./kiosk.controller.js";

const router = express.Router();
router.post("/auth", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 10 }), signin);
router.post("/refresh", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 60 }), refresh);
router.get("/devices", requireSignin, adminOnly, devices);
router.patch("/devices/:deviceId/capabilities", requireSignin, adminOnly, updateDeviceCapabilities);
router.delete("/devices/:deviceId", requireSignin, adminOnly, revokeDevice);
router.use(requireKiosk);
router.get("/context", context);
router.get("/schedule", schedule);
router.delete("/device", deprovision);
router.put("/events/check-in", checkIn);
router.put("/events/early-finish", earlyFinish);

export default router;

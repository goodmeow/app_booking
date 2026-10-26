import express from "express";
import { menuAccess, requireSignin } from "../../security/auth.middleware.js";
import { failedLoginRateLimits, fixedWindowRateLimit, SHORT_WINDOW_MS } from "../../security/rate-limit.middleware.js";
import { requireKiosk } from "../../security/kiosk-auth.middleware.js";
import { bookSlot, checkIn, completeEvent, context, deprovision, devices, doorOpen, earlyFinish, extendEvent, instantBooking, refresh, revokeDevice, schedule, signin, updateDeviceCapabilities } from "./kiosk.controller.js";

const router = express.Router();

// Per-action limits: routine kiosk actions are generous, creating a booking is tighter.
const kioskLimit = (max) => fixedWindowRateLimit({ windowMs: SHORT_WINDOW_MS, max });
const refreshLimit = fixedWindowRateLimit({ windowMs: SHORT_WINDOW_MS, max: 60, skipSuccessfulRequests: true });
router.post("/auth", ...failedLoginRateLimits(), signin);
router.post("/refresh", refreshLimit, refresh);
router.get("/devices", requireSignin, menuAccess("devices"), devices);
router.patch("/devices/:deviceId/capabilities", requireSignin, menuAccess("devices"), updateDeviceCapabilities);
router.delete("/devices/:deviceId", requireSignin, menuAccess("devices"), revokeDevice);
router.use(requireKiosk);
router.get("/context", context);
router.get("/schedule", schedule);
router.delete("/device", deprovision);
router.post("/door-open", kioskLimit(60), doorOpen);
router.put("/events/check-in", checkIn);
router.post("/events/extend", kioskLimit(60), extendEvent);
router.post("/events/complete", kioskLimit(60), completeEvent);
router.post("/events/instant", kioskLimit(30), instantBooking);
// Scheduled booking for today from the kiosk (pick start and end times).
router.post("/events/book", kioskLimit(30), bookSlot);
router.put("/events/early-finish", earlyFinish);

export default router;

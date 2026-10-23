import express from "express";
import { adminOnly, requireSignin } from "../../security/auth.middleware.js";
import { failedLoginRateLimits, fixedWindowRateLimit } from "../../security/rate-limit.middleware.js";
import { requireKiosk } from "../../security/kiosk-auth.middleware.js";
import { bookSlot, checkIn, completeEvent, context, deprovision, devices, doorOpen, earlyFinish, extendEvent, instantBooking, refresh, revokeDevice, schedule, signin, updateDeviceCapabilities } from "./kiosk.controller.js";

const router = express.Router();
router.post("/auth", ...failedLoginRateLimits(), signin);
router.post("/refresh", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 60, skipSuccessfulRequests: true }), refresh);
router.get("/devices", requireSignin, adminOnly, devices);
router.patch("/devices/:deviceId/capabilities", requireSignin, adminOnly, updateDeviceCapabilities);
router.delete("/devices/:deviceId", requireSignin, adminOnly, revokeDevice);
router.use(requireKiosk);
router.get("/context", context);
router.get("/schedule", schedule);
router.delete("/device", deprovision);
router.post("/door-open", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 60 }), doorOpen);
router.put("/events/check-in", checkIn);
router.post("/events/extend", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 60 }), extendEvent);
router.post("/events/complete", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 60 }), completeEvent);
router.post("/events/instant", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 30 }), instantBooking);
// Pemesanan terjadwal hari ini dari kiosk (pilih jam mulai & selesai).
router.post("/events/book", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 30 }), bookSlot);
router.put("/events/early-finish", earlyFinish);

export default router;

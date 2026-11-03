import express from "express";
import { menuAccess, requireSignin } from "../../security/auth.middleware.js";
import { failedLoginRateLimits, fixedWindowRateLimit, SHORT_WINDOW_MS } from "../../security/rate-limit.middleware.js";
import { requireKiosk } from "../../security/kiosk-auth.middleware.js";
import { bookSlot, checkIn, completeEvent, context, deprovision, devices, doorOpen, earlyFinish, extendEvent, faceAction, faceUnlock, instantBooking, refresh, revokeDevice, schedule, signin, updateDeviceCapabilities } from "./kiosk.controller.js";

const router = express.Router();

// Per-action limits: routine kiosk actions are generous, creating a booking is tighter.
// Every action gets its own scope so two actions never share one shared bucket.
const kioskLimit = (action, max) => fixedWindowRateLimit({ scope: `kiosk:${action}`, windowMs: SHORT_WINDOW_MS, max });
const refreshLimit = fixedWindowRateLimit({ scope: "kiosk:refresh", windowMs: SHORT_WINDOW_MS, max: 60, skipSuccessfulRequests: true });
router.post("/auth", ...failedLoginRateLimits({ scope: "kiosk:auth" }), signin);
router.post("/refresh", refreshLimit, refresh);
router.get("/devices", requireSignin, menuAccess("devices"), devices);
router.patch("/devices/:deviceId/capabilities", requireSignin, menuAccess("devices"), updateDeviceCapabilities);
router.delete("/devices/:deviceId", requireSignin, menuAccess("devices"), revokeDevice);
router.use(requireKiosk);
router.get("/context", context);
router.get("/schedule", schedule);
router.delete("/device", deprovision);
router.post("/door-open", kioskLimit("door-open", 60), doorOpen);
// Face unlock triggers an ML call on every attempt, so it gets a tighter budget
// than door-open. Non-match results come back as 200 allowed:false; a match with
// no booking here is a 403.
router.post("/face-unlock", kioskLimit("face-unlock", 30), faceUnlock);
// Face alternative to a card tap for check-in, extend and booking. Gets the
// same max as face-unlock because every call runs the ML service.
router.post("/face-action", kioskLimit("face-action", 30), faceAction);
router.put("/events/check-in", checkIn);
router.post("/events/extend", kioskLimit("extend-event", 60), extendEvent);
router.post("/events/complete", kioskLimit("complete-event", 60), completeEvent);
router.post("/events/instant", kioskLimit("instant-booking", 30), instantBooking);
// Scheduled booking for today from the kiosk (pick start and end times).
router.post("/events/book", kioskLimit("book-slot", 30), bookSlot);
router.put("/events/early-finish", earlyFinish);

export default router;

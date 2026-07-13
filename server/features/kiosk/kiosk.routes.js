import express from "express";
import { fixedWindowRateLimit } from "../../security/rate-limit.middleware.js";
import { requireKiosk } from "../../security/kiosk-auth.middleware.js";
import { checkIn, context, earlyFinish, schedule, signin } from "./kiosk.controller.js";

const router = express.Router();
router.post("/auth", fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 10 }), signin);
router.use(requireKiosk);
router.get("/context", context);
router.get("/schedule", schedule);
router.put("/events/check-in", checkIn);
router.put("/events/early-finish", earlyFinish);

export default router;

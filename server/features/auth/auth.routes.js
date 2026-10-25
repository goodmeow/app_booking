import express from "express";
import { doorOpen, signin, signout, signup } from "./auth.controller.js";
import { requireSignin } from "../../security/auth.middleware.js";
import { failedLoginRateLimits, fixedWindowRateLimit } from "../../security/rate-limit.middleware.js";

const router = express.Router();

router.post("/signin", ...failedLoginRateLimits(), signin);
router.post("/signup", fixedWindowRateLimit({ windowMs: 60 * 60_000, max: 5 }), signup);
router.get("/signout", signout);

export const doorRoute = [requireSignin, doorOpen];
export default router;

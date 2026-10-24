import express from "express";
import { fixedWindowRateLimit } from "../../security/rate-limit.middleware.js";
import { create, status } from "./setup.controller.js";

const router = express.Router();

// Public bootstrap routes: the first admin has no account yet, so neither route
// can require a token. The limits are light for the status probe and strict for
// the one-time account creation.
router.get(
  "/status",
  fixedWindowRateLimit({ windowMs: 15 * 60_000, max: 60 }),
  status
);
router.post(
  "/",
  fixedWindowRateLimit({ windowMs: 60 * 60_000, max: 5 }),
  create
);

export default router;

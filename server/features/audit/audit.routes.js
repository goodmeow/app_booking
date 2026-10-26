import express from "express";
import { requireSignin, superAdminOnly } from "../../security/auth.middleware.js";
import { readAudit } from "./audit.controller.js";

const router = express.Router();
router.use(requireSignin, superAdminOnly);
router.get("/", readAudit);

export default router;

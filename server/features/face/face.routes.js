import express from "express";
import { menuAccess, requireSignin } from "../../security/auth.middleware.js";
import { faceStatus, listTemplates, listVerifyLog } from "./face.controller.js";

const router = express.Router();
router.use(requireSignin);

// Status has no menu gate: the CMS calls it to learn whether the Face menu
// should exist at all.
router.get("/status", faceStatus);

// Read-only data from the face service. No embedding is ever returned.
router.get("/templates", menuAccess("face"), listTemplates);
router.get("/verify-log", menuAccess("face"), listVerifyLog);

export default router;

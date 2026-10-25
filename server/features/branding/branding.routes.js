import express from "express";
import { adminOnly, requireSignin } from "../../security/auth.middleware.js";
import { asset, read, remove, save, upload } from "./branding.controller.js";

const router = express.Router();
router.get("/", read);
router.get("/:kind", asset);
router.put("/", requireSignin, adminOnly, save);
router.put("/:kind", requireSignin, adminOnly, upload);
router.delete("/:kind", requireSignin, adminOnly, remove);

export default router;

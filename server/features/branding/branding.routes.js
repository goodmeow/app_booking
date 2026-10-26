import express from "express";
import { menuAccess, requireSignin } from "../../security/auth.middleware.js";
import { asset, read, remove, save, upload } from "./branding.controller.js";

const router = express.Router();
router.get("/", read);
router.get("/:kind", asset);
router.put("/", requireSignin, menuAccess("settings"), save);
router.put("/:kind", requireSignin, menuAccess("settings"), upload);
router.delete("/:kind", requireSignin, menuAccess("settings"), remove);

export default router;

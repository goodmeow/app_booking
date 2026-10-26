import express from "express";
import { requireSignin, superAdminOnly } from "../../security/auth.middleware.js";
import { myMenus, readMatrix, updateMatrix } from "./menu-access.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/menus", myMenus);
router.get("/matrix", superAdminOnly, readMatrix);
router.put("/matrix", superAdminOnly, updateMatrix);

export default router;

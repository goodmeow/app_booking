import express from "express";
import { adminOnly, requireSignin, selfOrAdmin } from "../../security/auth.middleware.js";
import { changePassword, create, list, read, remove, update } from "./user.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/", list);
router.post("/", adminOnly, create);
router.put("/change-password", changePassword);
router.get("/:userId", selfOrAdmin(), read);
router.put("/:userId", selfOrAdmin(), update);
router.delete("/:userId", selfOrAdmin(), remove);
export default router;

import express from "express";
import { menuAccess, requireSignin } from "../../security/auth.middleware.js";
import { available, create, list, read, remove, status, update, usage } from "./room.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/", list);
router.post("/", menuAccess("rooms"), create);
router.get("/available", available);
router.get("/usage-report", menuAccess("report"), usage);
router.get("/status", status);
router.get("/:roomId", read);
router.put("/:roomId", menuAccess("rooms"), update);
router.delete("/:roomId", menuAccess("rooms"), remove);
export default router;

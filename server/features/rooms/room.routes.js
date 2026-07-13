import express from "express";
import { adminOnly, requireSignin } from "../../security/auth.middleware.js";
import { available, create, list, read, remove, update, usage } from "./room.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/", list);
router.post("/", adminOnly, create);
router.get("/available", available);
router.get("/usage-report", adminOnly, usage);
router.get("/:roomId", read);
router.put("/:roomId", adminOnly, update);
router.delete("/:roomId", adminOnly, remove);
export default router;

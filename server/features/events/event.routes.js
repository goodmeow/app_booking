import express from "express";
import { requireSignin } from "../../security/auth.middleware.js";
import { add, cancel, checkIn, create, details, earlyFinish, list, preview, removeAttendee, update } from "./event.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/", list);
router.post("/", create);
router.put("/", update);
router.post("/preview", preview);
router.post("/attendee", add);
router.get("/details", details);
router.delete("/details", removeAttendee);
router.put("/delete", cancel);
router.put("/check-in", checkIn);
router.put("/early-finish", earlyFinish);
router.patch("/:eventId", update);
router.delete("/:eventId", cancel);
export default router;

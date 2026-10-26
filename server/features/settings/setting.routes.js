import express from "express";
import { menuAccess, requireSignin } from "../../security/auth.middleware.js";
import { backupNow, cards, createCard, editCard, read, readPublic, removeCard, update } from "./setting.controller.js";

const router = express.Router();
// Read-only public flag so the sign-in page can hide the signup link before
// authentication. It exposes nothing besides the toggle state.
router.get("/public", readPublic);
router.use(requireSignin);
router.get("/", read);
router.post("/backup/run", menuAccess("settings"), backupNow);
router.put("/", menuAccess("settings"), update);
router.get("/card-master", menuAccess("settings"), cards);
router.post("/card-master", menuAccess("settings"), createCard);
router.put("/card-master/:idCardMaster", menuAccess("settings"), editCard);
router.delete("/card-master/:idCardMaster", menuAccess("settings"), removeCard);
export default router;

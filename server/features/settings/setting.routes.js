import express from "express";
import { adminOnly, requireSignin } from "../../security/auth.middleware.js";
import { backupNow, cards, createCard, editCard, read, readPublic, removeCard, update } from "./setting.controller.js";

const router = express.Router();
// Read-only public flag so the sign-in page can hide the signup link before
// authentication. It exposes nothing besides the toggle state.
router.get("/public", readPublic);
router.use(requireSignin);
router.get("/", read);
router.post("/backup/run", adminOnly, backupNow);
router.put("/", adminOnly, update);
router.get("/card-master", adminOnly, cards);
router.post("/card-master", adminOnly, createCard);
router.put("/card-master/:idCardMaster", adminOnly, editCard);
router.delete("/card-master/:idCardMaster", adminOnly, removeCard);
export default router;

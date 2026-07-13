import express from "express";
import { adminOnly, requireSignin } from "../../security/auth.middleware.js";
import { cards, createCard, editCard, read, removeCard, update } from "./setting.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/", read);
router.put("/", adminOnly, update);
router.get("/card-master", adminOnly, cards);
router.post("/card-master", adminOnly, createCard);
router.put("/card-master/:idCardMaster", adminOnly, editCard);
router.delete("/card-master/:idCardMaster", adminOnly, removeCard);
export default router;

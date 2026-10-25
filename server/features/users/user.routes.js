import express from "express";
import { adminOnly, requireSignin, selfOrAdmin } from "../../security/auth.middleware.js";
import { addCard, bulkImport, changePassword, create, list, read, remove, update, updateCardStatus } from "./user.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/", list);
router.post("/", adminOnly, create);
router.post("/import", adminOnly, bulkImport);
router.put("/change-password", changePassword);
// Card mutations are management actions: an employee cannot move a card to
// their account, and a lost report has to revoke the door master list too.
router.post("/:userId/cards", adminOnly, addCard);
router.patch("/:userId/cards/:cardId", adminOnly, updateCardStatus);
router.get("/:userId", selfOrAdmin(), read);
router.put("/:userId", selfOrAdmin(), update);
router.delete("/:userId", selfOrAdmin(), remove);
export default router;

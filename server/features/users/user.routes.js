import express from "express";
import { menuAccess, requireSignin, selfOrMenu } from "../../security/auth.middleware.js";
import { addCard, bulkImport, changePassword, create, list, read, remove, update, updateCardStatus } from "./user.controller.js";

const router = express.Router();
router.use(requireSignin);
router.get("/", list);
router.post("/", menuAccess("users"), create);
router.post("/import", menuAccess("users"), bulkImport);
router.put("/change-password", changePassword);
// Card mutations are management actions: an employee cannot move a card to
// their account, and a lost report has to revoke the door master list too.
router.post("/:userId/cards", menuAccess("users"), addCard);
router.patch("/:userId/cards/:cardId", menuAccess("users"), updateCardStatus);
router.get("/:userId", selfOrMenu("users"), read);
router.put("/:userId", selfOrMenu("users"), update);
router.delete("/:userId", menuAccess("users"), remove);
export default router;

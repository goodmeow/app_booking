import { badRequest } from "../../lib/http-error.js";
import {
  addUserCard,
  changeUserPassword,
  createUser,
  deleteUser,
  editUser,
  getUser,
  getUsers,
  markUserCardLost,
} from "./user.service.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const list = run(async (req, res) => res.json(await getUsers(req.auth, req.query)));
export const read = run(async (req, res) => res.json(await getUser(req.params.userId, req.auth)));
export const create = run(async (req, res) => res.status(201).json(await createUser(req.body, req.auth)));
export const update = run(async (req, res) => res.json(await editUser(req.params.userId, req.body, req.auth)));
export const remove = run(async (req, res) => res.json(await deleteUser(req.params.userId, req.auth)));

// POST /api/users/:userId/cards — a second card is allowed, a third active card
// is not. The service owns the limit, the controller only forwards the number.
export const addCard = run(async (req, res) => {
  const card = await addUserCard(req.params.userId, req.body?.card_number);
  res.status(201).json(card);
});

// PATCH /api/users/:userId/cards/:cardId — only the lost transition exists.
// Deleting a card would lose the history of a card that is still in the wild.
export const markCardLost = run(async (req, res) => {
  if (req.body?.status !== "lost") {
    throw badRequest("INVALID_CARD_STATUS", 'Only status "lost" is supported');
  }
  res.json(await markUserCardLost(req.params.userId, req.params.cardId, req.auth));
});

export const changePassword = run(async (req, res) => {
  const revokedDevices = await changeUserPassword(req.body, req.auth);
  for (const device of revokedDevices) {
    req.io?.of("/").in(`device:${device.device_id}`).disconnectSockets(true);
  }
  res.json({ message: "Password successfully changed" });
});

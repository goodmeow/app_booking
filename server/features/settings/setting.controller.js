import { badRequest, HttpError, notFound } from "../../lib/http-error.js";
import { deleteCard, getSettings, insertCard, listCards, updateCard, updateSettings } from "./setting.repository.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) {
    if (error.code === "23505") return next(new HttpError(409, "CARD_EXISTS", "Card number already exists"));
    next(error);
  }
};

export const read = run(async (req, res) => res.json((await getSettings()) || {}));
export const update = run(async (req, res) => {
  const required = ["id", "lock_timer", "led_timer", "table_input", "not_checked_in_time_limit", "time_of_event_start_soon", "available_color", "will_start_color", "on_meeting_color"];
  if (required.some((field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === "")) {
    throw badRequest("INVALID_SETTINGS", "Every settings field is required");
  }
  if (!(await updateSettings(req.body.id, req.body))) throw notFound("Settings not found");
  req.io?.emit("response:setting", { type: "settings:changed" });
  res.json({ status: "updated", message: "Setting successfully updated" });
});
export const cards = run(async (req, res) => res.json(await listCards(req.query.card_number)));
export const createCard = run(async (req, res) => {
  if (!req.body.card_number) throw badRequest("INVALID_CARD", "Card number is required");
  res.status(201).json(await insertCard(req.body.card_number, req.auth._id));
});
export const editCard = run(async (req, res) => {
  if (!req.body.card_number) throw badRequest("INVALID_CARD", "Card number is required");
  const card = await updateCard(req.params.idCardMaster, req.body.card_number, req.auth._id);
  if (!card) throw notFound("Card not found");
  res.json(card);
});
export const removeCard = run(async (req, res) => {
  if (!(await deleteCard(req.params.idCardMaster))) throw notFound("Card not found");
  res.json({ status: "deleted", message: "Card successfully deleted" });
});

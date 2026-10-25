import { badRequest, HttpError, notFound } from "../../lib/http-error.js";
import { deleteCard, getSettings, insertCard, listCards, updateCard, updateSettings } from "./setting.repository.js";
import { runBackup } from "./backup.service.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) {
    if (error.code === "23505") return next(new HttpError(409, "CARD_EXISTS", "Card number already exists"));
    next(error);
  }
};

export const read = run(async (req, res) => res.json((await getSettings()) || {}));
export const readPublic = run(async (req, res) => {
  const settings = await getSettings();
  res.json({
    self_signup_enabled: settings?.self_signup_enabled === true,
    week_start_day: settings?.week_start_day ?? 1,
  });
});
export const update = run(async (req, res) => {
  const settingsId = req.body.id || req.body._id;
  const required = ["lock_timer", "led_timer", "table_input", "not_checked_in_time_limit", "time_of_event_start_soon", "available_color", "will_start_color", "on_meeting_color", "self_signup_enabled", "week_start_day", "backup_enabled", "backup_path", "backup_time", "backup_retention_days"];
  if (!settingsId || required.some((field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === "")) {
    throw badRequest("INVALID_SETTINGS", "Every settings field is required");
  }
  if (typeof req.body.self_signup_enabled !== "boolean") {
    throw badRequest("INVALID_SETTINGS", "self_signup_enabled must be a boolean");
  }
  const weekStartDay = Number(req.body.week_start_day);
  if (!Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
    throw badRequest("INVALID_SETTINGS", "week_start_day must be an integer from 0 to 6");
  }
  if (typeof req.body.backup_enabled !== "boolean") {
    throw badRequest("INVALID_SETTINGS", "backup_enabled must be a boolean");
  }
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(req.body.backup_time || ""))) {
    throw badRequest("INVALID_SETTINGS", "backup_time must use HH:MM");
  }
  const retention = Number(req.body.backup_retention_days);
  if (!Number.isInteger(retention) || retention < 1 || retention > 365) {
    throw badRequest("INVALID_SETTINGS", "backup_retention_days must be 1-365");
  }
  if (!String(req.body.backup_path || "").startsWith("/")) {
    throw badRequest("INVALID_SETTINGS", "backup_path must be absolute");
  }
  if (!(await updateSettings(settingsId, req.body))) throw notFound("Settings not found");
  req.io?.emit("response:setting", { type: "settings:changed" });
  res.json({ status: "updated", message: "Setting successfully updated" });
});
export const cards = run(async (req, res) => res.json(await listCards(req.query.card_number)));
export const backupNow = run(async (req, res) => res.json(await runBackup({ force: true })));
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

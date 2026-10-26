import { badRequest, HttpError, notFound } from "../../lib/http-error.js";
import { deleteCard, getSettings, insertCard, listCards, updateCard, updateSettings } from "./setting.repository.js";
import { runBackup } from "./backup.service.js";
import { withTransaction } from "../../db/pool.js";
import { isSuperAdminRole } from "../../lib/roles.js";
import { roleAllowsMenu } from "../access/menu-access.repository.js";
import { writeAudit } from "../audit/audit.repository.js";

const maskedCard = (value) => `****${String(value ?? "").trim().slice(-4)}`;

const settingsAuditValues = (settings) => {
  if (!settings) return {};
  const ignored = new Set(["_id", "created_at", "updated_at", "backup_last_at", "backup_last_status"]);
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !ignored.has(key)));
};

const changedValues = (before, after) => {
  const oldValues = {};
  const newValues = {};
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(value)) {
      oldValues[key] = before?.[key] ?? null;
      newValues[key] = value;
    }
  }
  return Object.keys(newValues).length ? { oldValues, newValues } : null;
};

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) {
    if (error.code === "23505") return next(new HttpError(409, "CARD_EXISTS", "Card number already exists"));
    next(error);
  }
};

export const read = run(async (req, res) => {
  const settings = (await getSettings()) || {};
  if (isSuperAdminRole(req.auth.role) || await roleAllowsMenu(req.auth.role, "settings")) {
    return res.json(settings);
  }
  // The matrix hides the Settings page, but old clients and the parity API
  // still call this read. Return only non-sensitive fields without the menu.
  res.json({
    _id: settings._id || null,
    week_start_day: settings.week_start_day ?? 1,
    self_signup_enabled: settings.self_signup_enabled === true,
  });
});
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
  await withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    const before = await getSettings(execute);
    if (!(await updateSettings(settingsId, req.body, execute))) throw notFound("Settings not found");
    const after = await getSettings(execute);
    const changed = changedValues(settingsAuditValues(before), settingsAuditValues(after));
    if (changed) {
      await writeAudit({
        principal: req.auth,
        action: "settings.update",
        entityType: "settings",
        entityId: settingsId,
        ...changed,
      }, execute);
    }
  });
  req.io?.emit("response:setting", { type: "settings:changed" });
  res.json({ status: "updated", message: "Setting successfully updated" });
});
export const cards = run(async (req, res) => res.json(await listCards(req.query.card_number)));
export const backupNow = run(async (req, res) => {
  const result = await runBackup({ force: true });
  await writeAudit({
    principal: req.auth,
    action: "settings.backup",
    entityType: "settings",
    newValues: { filename: result.filename },
  });
  res.json(result);
});
export const createCard = run(async (req, res) => {
  if (!req.body.card_number) throw badRequest("INVALID_CARD", "Card number is required");
  const card = await withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    const created = await insertCard(req.body.card_number, req.auth._id, execute);
    await writeAudit({
      principal: req.auth,
      action: "card_master.create",
      entityType: "card_master",
      entityId: created._id,
      newValues: { card: maskedCard(created.card_number) },
    }, execute);
    return created;
  });
  res.status(201).json(card);
});
export const editCard = run(async (req, res) => {
  if (!req.body.card_number) throw badRequest("INVALID_CARD", "Card number is required");
  const card = await withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    const updated = await updateCard(req.params.idCardMaster, req.body.card_number, req.auth._id, execute);
    if (!updated) throw notFound("Card not found");
    await writeAudit({
      principal: req.auth,
      action: "card_master.update",
      entityType: "card_master",
      entityId: updated._id,
      newValues: { card: maskedCard(updated.card_number) },
    }, execute);
    return updated;
  });
  res.json(card);
});
export const removeCard = run(async (req, res) => {
  await withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    if (!(await deleteCard(req.params.idCardMaster, execute))) throw notFound("Card not found");
    await writeAudit({
      principal: req.auth,
      action: "card_master.delete",
      entityType: "card_master",
      entityId: req.params.idCardMaster,
    }, execute);
  });
  res.json({ status: "deleted", message: "Card successfully deleted" });
});

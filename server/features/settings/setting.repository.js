import { query } from "../../db/pool.js";

export const getSettings = async (execute = query) => (await execute(
  `SELECT _id, lock_timer, led_timer, table_input, not_checked_in_time_limit,
          time_of_event_start_soon, available_color, will_start_color, on_meeting_color,
          self_signup_enabled, week_start_day, backup_enabled, backup_path, backup_time, backup_retention_days, backup_last_at, backup_last_status, created_at, updated_at
   FROM tbl_app_settings
   ORDER BY created_at
   LIMIT 1`
)).rows[0] || null;

export const getSelfSignupEnabled = async () => (await query(
  `SELECT self_signup_enabled
   FROM tbl_app_settings
   ORDER BY created_at
   LIMIT 1`
)).rows[0]?.self_signup_enabled === true;

export const updateSettings = async (id, values, execute = query) => (await execute(
  `UPDATE tbl_app_settings
   SET lock_timer = $2,
       led_timer = $3,
       table_input = $4,
       not_checked_in_time_limit = $5,
       time_of_event_start_soon = $6,
       available_color = $7,
       will_start_color = $8,
       on_meeting_color = $9,
       self_signup_enabled = $10,
       week_start_day = $11,
       backup_enabled = $12,
       backup_path = $13,
       backup_time = $14,
       backup_retention_days = $15,
       updated_at = now()
   WHERE _id = $1
   RETURNING _id`,
  [id, values.lock_timer, values.led_timer, values.table_input, values.not_checked_in_time_limit, values.time_of_event_start_soon, values.available_color, values.will_start_color, values.on_meeting_color, values.self_signup_enabled, values.week_start_day, values.backup_enabled, values.backup_path, values.backup_time, values.backup_retention_days]
)).rows[0] || null;

export const listCards = async (cardNumber) => (await query(
  `SELECT
     c._id, c.card_number, c.created_at, c.updated_at,
     creator.name AS created_by, updater.name AS updated_by
   FROM tbl_card_masters c
   LEFT JOIN tbl_users creator ON creator._id = c.created_by
   LEFT JOIN tbl_users updater ON updater._id = c.updated_by
   WHERE ($1::text IS NULL OR lower(c.card_number) = lower($1))
   ORDER BY c.created_at`,
  [cardNumber || null]
)).rows;

export const insertCard = async (cardNumber, principalId, execute = query) => (await execute(
  `INSERT INTO tbl_card_masters (card_number, created_by)
   VALUES ($1, $2)
   RETURNING _id, card_number, created_at`,
  [cardNumber, principalId]
)).rows[0];

export const updateCard = async (id, cardNumber, principalId, execute = query) => (await execute(
  `UPDATE tbl_card_masters
   SET card_number = $2, updated_by = $3, updated_at = now()
   WHERE _id = $1
   RETURNING _id, card_number, updated_at`,
  [id, cardNumber, principalId]
)).rows[0] || null;

export const deleteCard = async (id, execute = query) => (await execute(
  `DELETE FROM tbl_card_masters WHERE _id = $1 RETURNING _id`,
  [id]
)).rows[0] || null;

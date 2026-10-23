import { query } from "../../db/pool.js";

const safeColumns = `
  u._id, u.name, u.email, u.username, u.role_id, u.card_number,
  u.type, u.floor, u.capacity, u.building, u.feature,
  u.is_deleted, u.created_at, u.updated_at
`;

const publicRoomColumns = `
  u._id, u.name, u.email, u.username, u.type,
  u.floor, u.capacity, u.building, u.feature
`;

const managedRoomColumns = `${publicRoomColumns}, u.role_id`;

const masterCardFlag = `EXISTS (
  SELECT 1 FROM tbl_card_masters c WHERE lower(c.card_number) = lower(u.card_number)
) AS is_master_card`;

export const listEmployees = async () => (await query(
  `SELECT u._id, u.name, u.email, u.username, u.type, u.card_number, u.floor,
          ${masterCardFlag}
   FROM tbl_users u
   WHERE u.type = 'employee' AND u.is_deleted IS NOT TRUE
   ORDER BY u.name`
)).rows;

export const listRooms = async ({ building, capacity, floor } = {}, privileged = false) => (await query(
  `SELECT ${privileged ? managedRoomColumns : publicRoomColumns}
   FROM tbl_users u
   WHERE u.type = 'room'
     AND u.is_deleted IS NOT TRUE
     AND ($1::text IS NULL OR u.building = $1)
     AND ($2::text IS NULL OR u.capacity = $2)
     AND ($3::text IS NULL OR u.floor = $3)
   ORDER BY u.name`,
  [building || null, capacity || null, floor || null]
)).rows;

export const findRoomById = async (id, privileged = false) => (await query(
  `SELECT ${privileged ? managedRoomColumns : publicRoomColumns}
   FROM tbl_users u
   WHERE u._id = $1 AND u.type = 'room' AND u.is_deleted IS NOT TRUE
   LIMIT 1`,
  [id]
)).rows[0] || null;

export const findAccountById = async (id, type) => (await query(
  `SELECT ${safeColumns}, ${masterCardFlag}
   FROM tbl_users u
   WHERE u._id = $1
     AND ($2::text IS NULL OR u.type = $2)
     AND u.is_deleted IS NOT TRUE
   LIMIT 1`,
  [id, type || null]
)).rows[0] || null;

export const findAccountWithPassword = async (id) => (await query(
  `SELECT u._id, u.password, u.type, u.is_deleted
   FROM tbl_users u WHERE u._id = $1 LIMIT 1`,
  [id]
)).rows[0] || null;

export const setMasterCard = async (cardNumber, enabled, principalId, execute = query) => {
  const value = String(cardNumber || "").trim();
  if (!value) return;
  if (enabled) {
    await execute(
      `INSERT INTO tbl_card_masters (card_number, created_by)
       VALUES ($1, $2)
       ON CONFLICT (card_number) DO NOTHING`,
      [value, principalId || null]
    );
    return;
  }
  await execute(`DELETE FROM tbl_card_masters WHERE lower(card_number) = lower($1)`, [value]);
};

export const insertAccount = async ({ name, email, username, password, roleId, cardNumber, type, floor, capacity, building, feature }) => (await query(
  `INSERT INTO tbl_users
     (name, email, username, password, role_id, card_number, type, floor, capacity, building, feature, is_deleted)
   VALUES
     ($1, lower($2), nullif(btrim($3), ''), $4, $5, nullif($6, ''), $7,
      nullif($8, ''), nullif($9, ''), nullif($10, ''), nullif($11, ''), false)
   RETURNING _id, name, email, username, role_id, card_number, type, floor, capacity, building, feature, created_at`,
  [name, email, username || null, password || null, roleId || null, cardNumber || null, type, floor || null, capacity || null, building || null, feature || null]
)).rows[0];

export const updateAccount = async (id, values, type) => (await query(
  `UPDATE tbl_users
   SET name = COALESCE($2, name),
       email = COALESCE(lower($3), email),
       username = CASE WHEN $4::boolean THEN nullif(btrim($5), '') ELSE username END,
       role_id = COALESCE($6, role_id),
       card_number = CASE WHEN $7::boolean THEN nullif($8, '') ELSE card_number END,
       floor = CASE WHEN $9::boolean THEN nullif($10, '') ELSE floor END,
       capacity = CASE WHEN $11::boolean THEN nullif($12, '') ELSE capacity END,
       building = CASE WHEN $13::boolean THEN nullif($14, '') ELSE building END,
       feature = CASE WHEN $15::boolean THEN nullif($16, '') ELSE feature END,
       updated_at = now()
   WHERE _id = $1 AND type = $17 AND is_deleted IS NOT TRUE
   RETURNING _id, name, email, username, role_id, card_number, type, floor, capacity, building, feature, created_at, updated_at`,
  [
    id,
    values.name ?? null,
    values.email ?? null,
    Object.hasOwn(values, "username"), values.username ?? null,
    values.roleId ?? null,
    Object.hasOwn(values, "card_number"), values.card_number ?? null,
    Object.hasOwn(values, "floor"), values.floor ?? null,
    Object.hasOwn(values, "capacity"), values.capacity ?? null,
    Object.hasOwn(values, "building"), values.building ?? null,
    Object.hasOwn(values, "feature"), values.feature ?? null,
    type,
  ]
)).rows[0] || null;

export const updatePassword = async (id, password, execute = query) => (await execute(
  `UPDATE tbl_users SET password = $2, updated_at = now()
   WHERE _id = $1 AND is_deleted IS NOT TRUE
   RETURNING _id`,
  [id, password]
)).rowCount === 1;

export const softDeleteAccount = async (id, type) => (await query(
  `UPDATE tbl_users SET is_deleted = true, updated_at = now()
   WHERE _id = $1 AND type = $2 AND is_deleted IS NOT TRUE
   RETURNING _id, name, email, type`,
  [id, type]
)).rows[0] || null;

export const listAvailableRooms = async ({ start, end, roomEmail }) => (await query(
  `SELECT u._id, u.name, u.email
   FROM tbl_users u
   WHERE u.type = 'room'
     AND u.is_deleted IS NOT TRUE
     AND ($3::text IS NULL OR lower(u.email) = lower($3))
     AND NOT EXISTS (
       SELECT 1 FROM tbl_event_rooms er
       WHERE er.room_id = u._id
         AND er.active
         AND er.occupied_at && tstzrange($1::timestamptz, $2::timestamptz, '[)')
     )
   ORDER BY u.name`,
  [start, end, roomEmail || null]
)).rows;

export const roomUsageReport = async ({ start, end, timezone }) => (await query(
  `WITH bounds AS (
     SELECT
       $1::date::timestamp AT TIME ZONE $3 AS range_start,
       ($2::date + 1)::timestamp AT TIME ZONE $3 AS range_end
   ), meetings AS (
     SELECT
       er.room_id,
       e._id,
       e.subject,
       e.organizer,
       e.description,
       e.start_date AT TIME ZONE e.timezone AS start_date,
       e.end_date AT TIME ZONE e.timezone AS end_date,
       e.checked_in,
       greatest(lower(er.occupied_at), b.range_start) AS clipped_start,
       least(upper(er.occupied_at), b.range_end) AS clipped_end
     FROM tbl_event_rooms er
     JOIN tbl_events e ON e._id = er.event_id
     CROSS JOIN bounds b
     WHERE er.active
       AND er.occupied_at && tstzrange(b.range_start, b.range_end, '[)')
   ), aggregate AS (
     SELECT
       room_id,
       sum(clipped_end - clipped_start) AS usage,
       jsonb_agg(jsonb_build_object(
         'id', _id,
         'subject', subject,
         'organizer', organizer,
         'description', description,
         'start_date', start_date,
         'end_date', end_date,
         'checked_in', checked_in
       ) ORDER BY start_date) AS meetings
     FROM meetings
     GROUP BY room_id
   )
   SELECT
     u.name AS room_name,
     u.email AS room_mail,
     COALESCE(a.usage::text, '00:00:00') AS total_pemakaian,
     COALESCE(a.meetings, '[]'::jsonb) AS list_meeting
   FROM tbl_users u
   LEFT JOIN aggregate a ON a.room_id = u._id
   WHERE u.type = 'room' AND u.is_deleted IS NOT TRUE
   ORDER BY u.name`,
  [start, end, timezone]
)).rows;

// Current room status: who is using it, until when, and whether its tablet is online.
export const listRoomStatus = async () => (await query(
  `SELECT
     u._id,
     u.name,
     u.floor,
     u.capacity,
     u.building,
     e._id AS event_id,
     split_part(btrim(organizer.name), ' ', 1) AS organizer_first_name,
     e.start_date AT TIME ZONE e.timezone AS start_at,
     e.end_date AT TIME ZONE e.timezone AS end_at,
     e.checked_in,
     COALESCE(dev.online, false) AS tablet_online
   FROM tbl_users u
   LEFT JOIN LATERAL (
     SELECT room_booking.event_id
     FROM tbl_event_rooms room_booking
     WHERE room_booking.room_id = u._id
       AND room_booking.active
       AND room_booking.occupied_at @> now()
     LIMIT 1
   ) occupancy ON TRUE
   LEFT JOIN tbl_events e
     ON e._id = occupancy.event_id
    AND e.is_cancel IS NOT TRUE
   LEFT JOIN tbl_users organizer ON organizer._id = e.organizer_id
   LEFT JOIN LATERAL (
     SELECT bool_or(
       device.revoked_at IS NULL
       AND device.last_seen_at > now() - interval '60 seconds'
     ) AS online
     FROM tbl_kiosk_devices device
     WHERE device.room_id = u._id
   ) dev ON TRUE
   WHERE u.type = 'room' AND u.is_deleted IS NOT TRUE
   ORDER BY u.building, u.floor, u.name`
)).rows;

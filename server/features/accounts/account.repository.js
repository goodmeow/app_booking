import { query } from "../../db/pool.js";

const safeColumns = `
  u._id, u.name, u.email, u.username, u.role_id, u.employee_id,
  u.type, u.floor, u.floors, u.capacity, u.building, u.feature,
  u.is_deleted, u.must_change_password, u.created_at, u.updated_at
`;

const publicRoomColumns = `
  u._id, u.name, u.email, u.username, u.type,
  u.floor, u.capacity, u.building, u.feature
`;

const managedRoomColumns = `${publicRoomColumns}, u.role_id`;

// Every card of a user, including the lost ones. Cards are a credential, so a
// query must ask for this column explicitly and the directory projections below
// never do.
const userCardColumns = `COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'id', card._id,
    'card_number', card.card_number,
    'status', card.status,
    'lost_at', card.lost_at
  ) ORDER BY card.created_at)
  FROM tbl_user_cards card
  WHERE card.user_id = u._id
), '[]'::jsonb) AS cards`;

// The door master list is a separate table. A user counts as a master-card
// holder while at least one of their active cards is still in that list, so
// marking a card lost also clears the flag.
const masterCardFlag = `EXISTS (
  SELECT 1
  FROM tbl_user_cards card
  JOIN tbl_card_masters master
    ON lower(master.card_number) = lower(card.card_number)
  WHERE card.user_id = u._id
    AND card.status = 'active'
) AS is_master_card`;

export const listEmployees = async () => (await query(
  `SELECT u._id, u.name, u.email, u.username, u.employee_id, u.role_id, u.type, u.floor, u.floors,
          u.must_change_password, u.is_protected,
          ${masterCardFlag},
          ${userCardColumns}
   FROM tbl_users u
   WHERE u.type = 'employee' AND u.is_deleted IS NOT TRUE
   ORDER BY u.name`
)).rows;

// Employee directory columns for non-admins: identity only, so a card number or
// a work floor can never be selected into a response by accident.
const directoryColumns = `
  u._id, u.name, u.email, u.type
`;

// Without a floor the whole directory is listed; that is only used for the
// "all" floor group, which is company-wide.
export const listEmployeeDirectory = async (floors) => (await query(
  `SELECT ${directoryColumns}
   FROM tbl_users u
   WHERE u.type = 'employee'
     AND u.is_deleted IS NOT TRUE
     AND (
       $1::text[] IS NULL
       OR u.floor = ANY($1::text[])
       OR u.floors && $1::text[]
     )
   ORDER BY u.name`,
  [Array.isArray(floors) && floors.length ? floors : null]
)).rows;

// Case-insensitive "contains" search over name or email; strpos keeps the user
// input literal, so % and _ are not treated as wildcards.
export const searchEmployeeDirectory = async ({ term, limit }) => (await query(
  `SELECT ${directoryColumns}
   FROM tbl_users u
   WHERE u.type = 'employee'
     AND u.is_deleted IS NOT TRUE
     AND (
       strpos(lower(u.name), lower($1)) > 0
       OR strpos(lower(u.email), lower($1)) > 0
     )
   ORDER BY u.name
   LIMIT $2`,
  [term, limit]
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

export const findAccountById = async (id, type, execute = query) => (await execute(
  `SELECT ${safeColumns}, ${masterCardFlag}, ${userCardColumns}
   FROM tbl_users u
   WHERE u._id = $1
     AND ($2::text IS NULL OR u.type = $2)
     AND u.is_deleted IS NOT TRUE
   LIMIT 1`,
  [id, type || null]
)).rows[0] || null;

export const findRoleNameById = async (roleId, execute = query) => (await execute(
  `SELECT lower(role_name) AS role_name
   FROM tbl_role
   WHERE _id = $1
     AND is_deleted IS NOT TRUE
   LIMIT 1`,
  [roleId]
)).rows[0]?.role_name || null;

export const isProtectedAccount = async (id, execute = query) => (await execute(
  `SELECT is_protected
   FROM tbl_users
   WHERE _id = $1
     AND type = 'employee'
     AND is_deleted IS NOT TRUE
   LIMIT 1`,
  [id]
)).rows[0]?.is_protected === true;

export const findEmployeeByEmployeeId = async (employeeId, execute = query) => (await execute(
  `SELECT ${safeColumns}, ${masterCardFlag}, ${userCardColumns}
   FROM tbl_users u
   WHERE u.type = 'employee'
     AND u.is_deleted IS NOT TRUE
     AND lower(btrim(u.employee_id)) = lower(btrim($1))
   LIMIT 1`,
  [employeeId]
)).rows[0] || null;

export const findAccountWithPassword = async (id) => (await query(
  `SELECT u._id, u.name, u.password, u.type, u.is_deleted,
          lower(r.role_name) AS role
   FROM tbl_users u
   LEFT JOIN tbl_role r ON r._id = u.role_id
   WHERE u._id = $1
   LIMIT 1`,
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

export const insertAccount = async ({ name, email, username, password, roleId, employeeId, type, floor, floors, capacity, building, feature, mustChangePassword = false }, execute = query) => (await execute(
  `INSERT INTO tbl_users
     (name, email, username, password, role_id, employee_id, type, floor, floors, capacity, building, feature, must_change_password, is_deleted)
   VALUES
     ($1, lower($2), nullif(btrim($3), ''), $4, $5, nullif(btrim($6), ''), $7,
      nullif($8, ''), $9::text[], nullif($10, ''), nullif($11, ''), nullif($12, ''), $13, false)
   RETURNING _id, name, email, username, role_id, employee_id,
             type, floor, floors, capacity, building, feature, must_change_password, created_at`,
  [name, email, username || null, password || null, roleId || null, employeeId || null, type, floor || null, floors || [], capacity || null, building || null, feature || null, Boolean(mustChangePassword)]
)).rows[0];

export const updateAccount = async (id, values, type, execute = query) => (await execute(
  `UPDATE tbl_users
   SET name = COALESCE($2, name),
       email = COALESCE(lower($3), email),
       username = CASE WHEN $4::boolean THEN nullif(btrim($5), '') ELSE username END,
       role_id = COALESCE($6, role_id),
       employee_id = CASE WHEN $7::boolean THEN nullif(btrim($8), '') ELSE employee_id END,
       floor = CASE WHEN $9::boolean THEN nullif(btrim($10), '') ELSE floor END,
       floors = CASE WHEN $11::boolean THEN $12::text[] ELSE floors END,
       capacity = CASE WHEN $13::boolean THEN nullif(btrim($14), '') ELSE capacity END,
       building = CASE WHEN $15::boolean THEN nullif(btrim($16), '') ELSE building END,
       feature = CASE WHEN $17::boolean THEN nullif(btrim($18), '') ELSE feature END,
       must_change_password = CASE WHEN $19::boolean THEN $20 ELSE must_change_password END,
       updated_at = now()
   WHERE _id = $1 AND type = $21 AND is_deleted IS NOT TRUE
   RETURNING _id, name, email, username, role_id, employee_id,
             type, floor, floors, capacity, building, feature, must_change_password, created_at, updated_at`,
  [
    id,
    values.name ?? null,
    values.email ?? null,
    Object.hasOwn(values, "username"), values.username ?? null,
    values.roleId ?? null,
    Object.hasOwn(values, "employeeId"), values.employeeId ?? null,
    Object.hasOwn(values, "floor"), values.floor ?? null,
    Object.hasOwn(values, "floors"), values.floors ?? [],
    Object.hasOwn(values, "capacity"), values.capacity ?? null,
    Object.hasOwn(values, "building"), values.building ?? null,
    Object.hasOwn(values, "feature"), values.feature ?? null,
    Object.hasOwn(values, "mustChangePassword"), Boolean(values.mustChangePassword),
    type,
  ]
)).rows[0] || null;

export const listUserCards = async (userId, execute = query) => (await execute(
  `SELECT _id AS id, card_number, status, lost_at, created_at
   FROM tbl_user_cards
   WHERE user_id = $1
   ORDER BY created_at, _id`,
  [userId]
)).rows;

export const findUserCard = async (userId, cardId, execute = query) => (await execute(
  `SELECT _id AS id, card_number, status, lost_at
   FROM tbl_user_cards
   WHERE _id = $1 AND user_id = $2
   LIMIT 1`,
  [cardId, userId]
)).rows[0] || null;

export const insertUserCard = async ({ userId, cardNumber }, execute = query) => (await execute(
  `INSERT INTO tbl_user_cards (user_id, card_number)
   VALUES ($1, btrim($2))
   RETURNING _id AS id, card_number, status, lost_at`,
  [userId, cardNumber]
)).rows[0];

export const setUserCardLost = async (cardId, execute = query) => (await execute(
  `UPDATE tbl_user_cards
   SET status = 'lost',
       lost_at = now(),
       updated_at = now()
   WHERE _id = $1 AND status = 'active'
   RETURNING _id AS id, card_number, status, lost_at`,
  [cardId]
)).rows[0] || null;

// Reactivation only applies to a card that is still on the same user. The card
// number stays globally unique, so a card moved to another person cannot be
// pulled back silently.
export const setUserCardActive = async (cardId, execute = query) => (await execute(
  `UPDATE tbl_user_cards
   SET status = 'active',
       lost_at = NULL,
       updated_at = now()
   WHERE _id = $1 AND status = 'lost'
   RETURNING _id AS id, card_number, status, lost_at`,
  [cardId]
)).rows[0] || null;

export const updatePassword = async (id, password, execute = query, mustChangePassword = false) => (await execute(
  `UPDATE tbl_users
   SET password = $2,
       must_change_password = $3,
       updated_at = now()
   WHERE _id = $1 AND is_deleted IS NOT TRUE
   RETURNING _id`,
  [id, password, mustChangePassword]
)).rowCount === 1;

export const softDeleteAccount = async (id, type, execute = query) => (await execute(
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

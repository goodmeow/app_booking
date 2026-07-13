import { query } from "../../db/pool.js";

const kioskRoomColumns = `
  u._id, u.name, u.email, u.password, u.type,
  u.floor, u.capacity, u.building, u.feature, u.is_deleted
`;

export const findKioskRoomByLogin = async (login) => (await query(
  `SELECT ${kioskRoomColumns}
   FROM tbl_users u
   WHERE u.type = 'room'
     AND u.is_deleted IS NOT TRUE
     AND (lower(u.email) = lower($1) OR (u.username IS NOT NULL AND lower(u.username) = lower($1)))
   LIMIT 1`,
  [String(login || "").trim()]
)).rows[0] || null;

export const findActiveKioskRoomById = async (id) => (await query(
  `SELECT ${kioskRoomColumns}
   FROM tbl_users u
   WHERE u._id = $1 AND u.type = 'room' AND u.is_deleted IS NOT TRUE
   LIMIT 1`,
  [id]
)).rows[0] || null;

export const listKioskScheduleRows = async ({ roomId, rangeStart, rangeEnd }) => (await query(
  `SELECT
     e._id,
     split_part(btrim(organizer.name), ' ', 1) AS organizer_first_name,
     e.start_date AT TIME ZONE e.timezone AS start_at,
     e.end_date AT TIME ZONE e.timezone AS end_at,
     e.timezone,
     e.checked_in,
     settings.time_of_event_start_soon AS early_minutes,
     settings.not_checked_in_time_limit AS late_minutes
   FROM tbl_event_rooms booking
   JOIN tbl_events e ON e._id = booking.event_id
   JOIN tbl_users organizer ON organizer._id = e.organizer_id
   CROSS JOIN LATERAL (SELECT * FROM tbl_app_settings ORDER BY created_at LIMIT 1) settings
   WHERE booking.room_id = $1
     AND booking.active
     AND booking.occupied_at && tstzrange($2::timestamptz, $3::timestamptz, '[)')
   ORDER BY start_at, e._id`,
  [roomId, rangeStart, rangeEnd]
)).rows;

export const findKioskEventActionContext = async ({ eventId, roomId, cardNumber }, execute = query) => (await execute(
  `SELECT
     e._id,
     e.start_date AT TIME ZONE e.timezone AS start_at,
     e.end_date AT TIME ZONE e.timezone AS end_at,
     e.checked_in,
     settings.time_of_event_start_soon AS early_minutes,
     settings.not_checked_in_time_limit AS late_minutes,
     (
       EXISTS (SELECT 1 FROM tbl_card_masters c WHERE lower(c.card_number) = lower($3))
       OR EXISTS (
         SELECT 1
         FROM tbl_users card_owner
         WHERE lower(card_owner.card_number) = lower($3)
           AND card_owner.type = 'employee'
           AND card_owner.is_deleted IS NOT TRUE
           AND (
             card_owner._id = e.organizer_id
             OR EXISTS (
               SELECT 1 FROM tbl_event_details attendee
               WHERE attendee.event_id = e._id
                 AND attendee.attendee_user_id = card_owner._id
                 AND attendee.is_deleted IS NOT TRUE
             )
           )
       )
     ) AS card_allowed
   FROM tbl_events e
   JOIN tbl_event_rooms booking
     ON booking.event_id = e._id
    AND booking.room_id = $2
    AND booking.active
   CROSS JOIN LATERAL (SELECT * FROM tbl_app_settings ORDER BY created_at LIMIT 1) settings
   WHERE e._id = $1 AND e.is_cancel IS NOT TRUE
   LIMIT 1
   FOR UPDATE OF e`,
  [eventId, roomId, String(cardNumber || "")]
)).rows[0] || null;

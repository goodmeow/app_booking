import { query } from "../../db/pool.js";
import { isUuid } from "../../lib/uuid.js";

const kioskRoomColumns = `
  u._id, u.name, u.email, u.password, u.type,
  u.floor, u.capacity, u.building, u.feature, u.is_deleted
`;

const kioskDeviceColumns = `
  d._id AS device_id, d.room_id, d.name AS device_name,
  d.token_version, d.refresh_expires_at, d.last_seen_at,
  d.nfc_enabled, d.led_enabled, d.show_subject,
  d.instant_enabled, d.schedule_enabled,
  d.revoked_at, d.created_at, d.updated_at,
  u.name AS room_name, u.email AS room_email, u.type AS room_type,
  u.floor, u.capacity, u.building, u.feature, u.is_deleted AS room_deleted
`;

export const createKioskDevice = async ({ roomId, name, refreshTokenHash, refreshExpiresAt }, execute = query) =>
  (
    await execute(
      `WITH inserted AS (
     INSERT INTO tbl_kiosk_devices
       (room_id, name, refresh_token_hash, refresh_expires_at, last_seen_at)
     VALUES ($1, $2, $3, $4, now())
     RETURNING *
   )
   SELECT ${kioskDeviceColumns}
   FROM inserted d
   JOIN tbl_users u ON u._id = d.room_id`,
      [roomId, name, refreshTokenHash, refreshExpiresAt],
    )
  ).rows[0];

export const findActiveKioskDeviceById = async (deviceId) => {
  if (!isUuid(deviceId)) return null;
  return (
    (
      await query(
        `SELECT ${kioskDeviceColumns}
   FROM tbl_kiosk_devices d
   JOIN tbl_users u ON u._id = d.room_id
   WHERE d._id = $1
     AND d.revoked_at IS NULL
     AND u.type = 'room'
     AND u.is_deleted IS NOT TRUE
   LIMIT 1`,
        [deviceId],
      )
    ).rows[0] || null
  );
};

export const rotateKioskRefreshToken = async ({ refreshTokenHash, nextHash, refreshExpiresAt }) => {
  const rotated = (
    await query(
      `WITH rotated AS (
     UPDATE tbl_kiosk_devices
     SET previous_refresh_token_hash = refresh_token_hash,
         previous_refresh_valid_until = now() + interval '30 seconds',
         refresh_token_hash = $2,
         refresh_expires_at = $3,
         token_version = token_version + 1,
         last_seen_at = now(),
         updated_at = now()
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND refresh_expires_at > now()
     RETURNING *
   )
   SELECT ${kioskDeviceColumns}
   FROM rotated d
   JOIN tbl_users u ON u._id = d.room_id
   WHERE u.type = 'room' AND u.is_deleted IS NOT TRUE`,
      [refreshTokenHash, nextHash, refreshExpiresAt],
    )
  ).rows[0];
  if (rotated) return rotated;

  return (
    (
      await query(
        `SELECT ${kioskDeviceColumns}
     FROM tbl_kiosk_devices d
     JOIN tbl_users u ON u._id = d.room_id
     WHERE d.previous_refresh_token_hash = $1
       AND d.previous_refresh_valid_until > now()
       AND d.refresh_token_hash = $2
       AND d.revoked_at IS NULL
       AND d.refresh_expires_at > now()
       AND u.type = 'room'
       AND u.is_deleted IS NOT TRUE
     LIMIT 1`,
        [refreshTokenHash, nextHash],
      )
    ).rows[0] || null
  );
};

export const revokeKioskDevice = async (deviceId, revokedBy = null) => {
  if (!isUuid(deviceId)) return null;
  return (
    (
      await query(
        `UPDATE tbl_kiosk_devices
   SET revoked_at = now(),
       revoked_by = $2,
       token_version = token_version + 1,
       updated_at = now()
   WHERE _id = $1 AND revoked_at IS NULL
   RETURNING _id AS device_id, room_id`,
        [deviceId, revokedBy],
      )
    ).rows[0] || null
  );
};

export const revokeRoomKioskDevices = async (roomId, revokedBy = null, execute = query) =>
  (
    await execute(
      `UPDATE tbl_kiosk_devices
   SET revoked_at = now(),
       revoked_by = $2,
       token_version = token_version + 1,
       updated_at = now()
   WHERE room_id = $1 AND revoked_at IS NULL
   RETURNING _id AS device_id, room_id`,
      [roomId, revokedBy],
    )
  ).rows;

export const listKioskDevices = async (roomId = null) => {
  if (roomId && !isUuid(roomId)) return [];
  return (
    await query(
      `SELECT
     d._id AS device_id, d.room_id, d.name AS device_name,
     d.refresh_expires_at, d.last_seen_at, d.revoked_at,
     d.nfc_enabled, d.led_enabled, d.show_subject,
     d.instant_enabled, d.schedule_enabled,
     d.created_at, d.updated_at,
     u.name AS room_name, u.email AS room_email,
     u.floor AS room_floor, u.floors AS room_floors
   FROM tbl_kiosk_devices d
   JOIN tbl_users u ON u._id = d.room_id
   WHERE ($1::uuid IS NULL OR d.room_id = $1)
   ORDER BY u.floor NULLS LAST, u.name, d.created_at, d._id`,
      [roomId || null],
    )
  ).rows;
};

export const updateKioskDeviceCapabilities = async ({
  deviceId,
  nfcEnabled = null,
  ledEnabled = null,
  showSubject = null,
  instantEnabled = null,
  scheduleEnabled = null,
}) => {
  if (!isUuid(deviceId)) return null;
  return (
    (
      await query(
        `WITH updated AS (
     UPDATE tbl_kiosk_devices
     SET nfc_enabled = COALESCE($2::boolean, nfc_enabled),
         led_enabled = COALESCE($3::boolean, led_enabled),
         show_subject = COALESCE($4::boolean, show_subject),
         instant_enabled = COALESCE($5::boolean, instant_enabled),
         schedule_enabled = COALESCE($6::boolean, schedule_enabled),
         updated_at = now()
     WHERE _id = $1 AND revoked_at IS NULL
     RETURNING *
   )
   SELECT ${kioskDeviceColumns}
   FROM updated d
   JOIN tbl_users u ON u._id = d.room_id`,
        [deviceId, nfcEnabled, ledEnabled, showSubject, instantEnabled, scheduleEnabled],
      )
    ).rows[0] || null
  );
};

export const findKioskRoomByLogin = async (login) =>
  (
    await query(
      `SELECT ${kioskRoomColumns}
   FROM tbl_users u
   WHERE u.type = 'room'
     AND u.is_deleted IS NOT TRUE
     AND (lower(u.email) = lower($1) OR (u.username IS NOT NULL AND lower(u.username) = lower($1)))
   LIMIT 1`,
      [String(login || "").trim()],
    )
  ).rows[0] || null;

export const listKioskScheduleRows = async ({ roomId, rangeStart, rangeEnd }) =>
  (
    await query(
      `SELECT
     e._id,
     split_part(btrim(organizer.name), ' ', 1) AS organizer_first_name,
     btrim(organizer.name) AS organizer_name,
     btrim(e.subject) AS subject,
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
      [roomId, rangeStart, rangeEnd],
    )
  ).rows;

export const findKioskEventActionContext = async ({ eventId, roomId, cardNumber }, execute = query) =>
  (
    await execute(
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
         FROM tbl_user_cards card
         JOIN tbl_users card_owner ON card_owner._id = card.user_id
         WHERE lower(btrim(card.card_number)) = lower(btrim($3))
           AND card.status = 'active'
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
      [eventId, roomId, String(cardNumber || "")],
    )
  ).rows[0] || null;

// Meetings in this room whose door window may still be open. The caller picks
// the one covering "now" (see activeDoorMeeting); a card only passes while its
// owner is the organizer, an attendee, or the card is a master card.
export const findKioskDoorContext = async ({ roomId, cardNumber }) =>
  (
    await query(
      `SELECT
     e._id,
     e.start_date AT TIME ZONE e.timezone AS start_at,
     e.end_date AT TIME ZONE e.timezone AS end_at,
     settings.time_of_event_start_soon AS early_minutes,
     (
       EXISTS (SELECT 1 FROM tbl_card_masters master WHERE lower(master.card_number) = lower($2))
       OR EXISTS (
         SELECT 1
         FROM tbl_user_cards card
         JOIN tbl_users owner ON owner._id = card.user_id
         WHERE lower(btrim(card.card_number)) = lower(btrim($2))
           AND card.status = 'active'
           AND owner.type = 'employee'
           AND owner.is_deleted IS NOT TRUE
           AND (
             owner._id = e.organizer_id
             OR EXISTS (
               SELECT 1
               FROM tbl_event_details attendee
               WHERE attendee.event_id = e._id
                 AND attendee.attendee_user_id = owner._id
                 AND attendee.is_deleted IS NOT TRUE
             )
           )
       )
     ) AS card_allowed
   FROM tbl_events e
   JOIN tbl_event_rooms booking
     ON booking.event_id = e._id
    AND booking.room_id = $1
    AND booking.active
   CROSS JOIN LATERAL (SELECT * FROM tbl_app_settings ORDER BY created_at LIMIT 1) settings
   WHERE e.is_cancel IS NOT TRUE
     AND (e.end_date AT TIME ZONE e.timezone) > now()
   ORDER BY start_at
   LIMIT 5`,
      [roomId, String(cardNumber || "")],
    )
  ).rows;

// Only an active card of an active employee resolves to a person. A card that
// was reported lost keeps its row (status 'lost') and is ignored here, which is
// what stops it from checking in or booking.
export const findEmployeeByCard = async (cardNumber) =>
  (
    await query(
      `SELECT u._id, u.name, u.email, u.employee_id, u.floor, u.floors, card.card_number
   FROM tbl_user_cards card
   JOIN tbl_users u ON u._id = card.user_id
   WHERE u.type = 'employee'
     AND u.is_deleted IS NOT TRUE
     AND card.status = 'active'
     AND lower(btrim(card.card_number)) = lower(btrim($1))
   ORDER BY card.created_at
   LIMIT 1`,
      [String(cardNumber || "")],
    )
  ).rows[0] || null;

// Face identity: resolve the matched account directly by user id, so face
// actions do not depend on the person owning a card.
export const findEmployeeByUserId = async (userId) => {
  if (!isUuid(userId)) return null;
  return (await query(
    `SELECT u._id, u.name, u.email, u.employee_id, u.floor, u.floors
     FROM tbl_users u
     WHERE u._id = $1
       AND u.type = 'employee'
       AND u.is_deleted IS NOT TRUE
     LIMIT 1`,
    [userId]
  )).rows[0] || null;
};

export const findEmployeesByEmployeeIds = async (employeeIds) => {
  if (!Array.isArray(employeeIds) || !employeeIds.length) return [];
  return (await query(
    `SELECT u._id, u.name, u.email, u.employee_id, u.floor, u.floors
     FROM tbl_users u
     WHERE u.employee_id = ANY($1::varchar[])
       AND u.type = 'employee'
       AND u.is_deleted IS NOT TRUE`,
    [employeeIds.map(String)]
  )).rows;
};

// Same as findKioskEventActionContext, but the caller already holds the person
// (face identity) instead of a card. `user_allowed` mirrors the card rule:
// organizer or attendee of the meeting.
export const findKioskEventActionContextByUser = async ({ eventId, roomId, userId, lock = true }, execute = query) => {
  if (!isUuid(eventId) || !isUuid(userId)) return null;
  return (await execute(
    `SELECT
       e._id,
       e.start_date AT TIME ZONE e.timezone AS start_at,
       e.end_date AT TIME ZONE e.timezone AS end_at,
       e.checked_in,
       settings.time_of_event_start_soon AS early_minutes,
       settings.not_checked_in_time_limit AS late_minutes,
       (
         e.organizer_id = $3
         OR EXISTS (
           SELECT 1
           FROM tbl_event_details attendee
           WHERE attendee.event_id = e._id
             AND attendee.attendee_user_id = $3
             AND attendee.is_deleted IS NOT TRUE
         )
       ) AS user_allowed
     FROM tbl_events e
     JOIN tbl_event_rooms booking
       ON booking.event_id = e._id
      AND booking.room_id = $2
      AND booking.active
     CROSS JOIN LATERAL (SELECT * FROM tbl_app_settings ORDER BY created_at LIMIT 1) settings
     WHERE e._id = $1 AND e.is_cancel IS NOT TRUE
     LIMIT 1
     ${lock ? "FOR UPDATE OF e" : ""}`,
    [eventId, roomId, userId]
  )).rows[0] || null;
};

// The face verify log gets one row per scan, so it needs the same retention as
// the audit log or it grows forever.
export const deleteExpiredFaceVerifyLog = async (days) => (await query(
  `DELETE FROM tbl_face_verify_log
   WHERE created_at < now() - make_interval(days => $1)`,
  [Math.max(1, Number(days) || 365)]
)).rowCount;

export const findKioskRoomEvent = async ({ eventId, roomId }, execute = query) =>
  (
    await execute(
      `SELECT
     e._id,
     e.subject,
     e.start_date AT TIME ZONE e.timezone AS start_at,
     e.end_date AT TIME ZONE e.timezone AS end_at,
     e.checked_in
   FROM tbl_events e
   JOIN tbl_event_rooms booking
     ON booking.event_id = e._id
    AND booking.room_id = $2
    AND booking.active
   WHERE e._id = $1
     AND e.is_cancel IS NOT TRUE
   LIMIT 1
   FOR UPDATE OF e`,
      [eventId, roomId],
    )
  ).rows[0] || null;

// Face-unlock authorization: given the employee_ids the face service matched,
// find an active booking in THIS kiosk's room where that person is organizer or
// attendee. Returns the candidate events so the service can apply the check-in
// window and resolve a face group with two accounts (decision (b) in the arch
// doc): whichever account actually has a booking here is the one that counts.
export const findFaceRoomBookings = async ({ roomId, employeeIds }, execute = query) => {
  if (!isUuid(roomId) || !Array.isArray(employeeIds) || !employeeIds.length) return [];
  return (await execute(
    `SELECT
       e._id AS event_id,
       e.start_date AT TIME ZONE e.timezone AS start_at,
       e.end_date AT TIME ZONE e.timezone AS end_at,
       e.checked_in,
       settings.time_of_event_start_soon AS early_minutes,
       settings.not_checked_in_time_limit AS late_minutes,
       u._id AS user_id,
       u.employee_id
     FROM tbl_events e
     JOIN tbl_event_rooms booking
       ON booking.event_id = e._id
      AND booking.room_id = $1
      AND booking.active
     JOIN tbl_users u
       ON u.employee_id = ANY($2::varchar[])
      AND u.type = 'employee'
      AND u.is_deleted IS NOT TRUE
     CROSS JOIN LATERAL (SELECT * FROM tbl_app_settings ORDER BY created_at LIMIT 1) settings
     WHERE e.is_cancel IS NOT TRUE
       AND (
         e.organizer_id = u._id
         OR EXISTS (
           SELECT 1
           FROM tbl_event_details attendee
           WHERE attendee.event_id = e._id
             AND attendee.attendee_user_id = u._id
             AND attendee.is_deleted IS NOT TRUE
         )
       )`,
    [roomId, employeeIds.map(String)]
  )).rows;
};

export const extendKioskRoomEvent = async ({ eventId, endAt }, execute = query) =>
  (
    await execute(
      `UPDATE tbl_events
   SET end_date = $2::timestamptz AT TIME ZONE timezone,
       updated_at = now()
   WHERE _id = $1
   RETURNING
     _id,
     subject,
     start_date AT TIME ZONE timezone AS start_at,
     end_date AT TIME ZONE timezone AS end_at`,
      [eventId, endAt],
    )
  ).rows[0];

export const touchKioskDevice = async (deviceId) => {
  await query(
    `UPDATE tbl_kiosk_devices
     SET last_seen_at = now()
     WHERE _id = $1
       AND (last_seen_at IS NULL OR last_seen_at < now() - interval '10 seconds')`,
    [deviceId],
  );
};

export const findActiveKioskDeviceForRoom = async (roomId, execute = query) =>
  (
    await execute(
      `SELECT _id, name, last_seen_at
   FROM tbl_kiosk_devices
   WHERE room_id = $1
     AND revoked_at IS NULL
     AND refresh_expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1`,
      [roomId],
    )
  ).rows[0] || null;

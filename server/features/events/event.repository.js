import { query, withTransaction } from "../../db/pool.js";

const eventInstantColumns = `
  e._id,
  e.organizer_id,
  e.organizer,
  e.booked_by,
  e.subject,
  e.description,
  e.start_date AT TIME ZONE e.timezone AS start_at,
  e.end_date AT TIME ZONE e.timezone AS end_at,
  e.timezone,
  e.series_id,
  e.occurrence_index,
  e.is_cancel,
  e.is_draft,
  e.is_allday,
  e.created_at,
  e.checked_in,
  e.late_threshold
`;

export const transaction = withTransaction;

export const findAccountsByEmails = async (emails, client = { query }) => {
  if (!emails.length) return [];
  return (await client.query(
    `SELECT _id, name, email, type
     FROM tbl_users
     WHERE lower(email) = ANY($1::text[])
       AND is_deleted IS NOT TRUE`,
    [emails.map((email) => String(email).trim().toLowerCase())]
  )).rows;
};

export const findAccountsByIds = async (ids, client = { query }) => {
  if (!ids.length) return [];
  return (await client.query(
    `SELECT _id, name, email, type
     FROM tbl_users
     WHERE _id = ANY($1::uuid[])
       AND is_deleted IS NOT TRUE`,
    [ids]
  )).rows;
};

// The organizer of a booking created on behalf of somebody else must be a real
// employee account. Rooms are excluded because a room cannot own a meeting.
export const findEmployeeByEmail = async (email, client = { query }) => (await client.query(
  `SELECT _id, name, email
   FROM tbl_users
   WHERE lower(btrim(email)) = $1
     AND type = 'employee'
     AND is_deleted IS NOT TRUE
   LIMIT 1`,
  [String(email).trim().toLowerCase()]
)).rows[0] || null;

export const findActiveRoom = async (identifier) => (await query(
  `SELECT _id, name, email
   FROM tbl_users
   WHERE type = 'room'
     AND is_deleted IS NOT TRUE
     AND (_id::text = $1 OR lower(email) = lower($1))
   LIMIT 1`,
  [String(identifier)]
)).rows[0] || null;

export const insertSeries = async (client, values) => (await client.query(
  `INSERT INTO tbl_event_series
     (organizer_id, subject, description, timezone, cadence, interval_count, weekdays, recurrence_end_date)
   VALUES ($1, $2, $3, $4, $5, $6, $7::smallint[], $8::date)
   RETURNING *`,
  [values.organizerId, values.subject, values.description, values.timezone, values.cadence, values.interval, values.weekdays, values.endDate]
)).rows[0];

export const insertEvent = async (client, values) => (await client.query(
  `INSERT INTO tbl_events
     (organizer_id, organizer, subject, description, start_date, end_date, timezone,
      series_id, occurrence_index, original_start, is_cancel, is_draft, is_allday, booked_by)
   VALUES
     ($1, $2, $3, $4,
      $5::timestamptz AT TIME ZONE $7,
      $6::timestamptz AT TIME ZONE $7,
      $7, $8, $9,
      $5::timestamptz AT TIME ZONE $7,
      false, false, false, $10)
   RETURNING
     _id, organizer, booked_by, subject, description,
     start_date AT TIME ZONE timezone AS start_at,
     end_date AT TIME ZONE timezone AS end_at,
     timezone, series_id, occurrence_index`,
  [
    values.organizerId,
    values.organizerEmail,
    values.subject,
    values.description,
    values.start,
    values.end,
    values.timezone,
    values.seriesId || null,
    values.occurrenceIndex ?? null,
    values.bookedBy || null,
  ]
)).rows[0];

export const insertEventParticipant = async (client, eventId, participant) => (await client.query(
  `INSERT INTO tbl_event_details
     (event_id, attendee_email, attendee_user_id, room_id, visitor_email, is_visitor, is_deleted)
   VALUES ($1, $2, $3, $4, $5, $6, false)
   RETURNING _id, event_id, attendee_email, attendee_user_id, room_id, visitor_email, is_visitor`,
  [eventId, participant.email, participant.userId || null, participant.roomId || null, participant.visitorEmail || null, Boolean(participant.visitorEmail)]
)).rows[0];

export const listEventsForPrincipal = async ({ principalId, role, floors, roomId, rangeStart, rangeEnd, allEvents = false }) => (await query(
  `SELECT DISTINCT
     ${eventInstantColumns},
     split_part(btrim(organizer_account.name), ' ', 1) AS organizer_first_name,
     booked_by_account.name AS booked_by_name,
     (
       $2 IN ('ADMIN', 'SUPER_ADMIN')
       OR e.organizer_id = $1
       OR e.booked_by = $1
       OR EXISTS (
         SELECT 1 FROM tbl_event_details access_detail
         WHERE access_detail.event_id = e._id
           AND access_detail.attendee_user_id = $1
           AND access_detail.is_deleted IS NOT TRUE
       )
       OR (
         $7::text[] IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM tbl_event_details floor_detail
           JOIN tbl_users floor_room ON floor_room._id = floor_detail.room_id
           WHERE floor_detail.event_id = e._id
             AND floor_detail.is_deleted IS NOT TRUE
             AND floor_room.type = 'room'
             AND (
               'all' = ANY($7::text[])
               OR lower(btrim(floor_room.floor)) = ANY($7::text[])
             )
         )
       )
     ) AS can_view_details,
     ARRAY(
       SELECT DISTINCT lower(btrim(floor_room.floor))
       FROM tbl_event_details floor_detail
       JOIN tbl_users floor_room ON floor_room._id = floor_detail.room_id
       WHERE floor_detail.event_id = e._id
         AND floor_detail.is_deleted IS NOT TRUE
         AND floor_room.type = 'room'
     ) AS room_floors
   FROM tbl_events e
   JOIN tbl_users organizer_account ON organizer_account._id = e.organizer_id
   LEFT JOIN tbl_users booked_by_account ON booked_by_account._id = e.booked_by
   LEFT JOIN tbl_event_rooms room_booking ON room_booking.event_id = e._id AND room_booking.active
   WHERE e.is_cancel IS NOT TRUE
     AND tstzrange(
       e.start_date AT TIME ZONE e.timezone,
       e.end_date AT TIME ZONE e.timezone,
       '[)'
     ) && tstzrange($4::timestamptz, $5::timestamptz, '[)')
     AND (
       ($3::uuid IS NOT NULL AND room_booking.room_id = $3)
       OR ($3::uuid IS NULL AND (
         ($6::boolean AND $2 IN ('ADMIN', 'SUPER_ADMIN'))
         OR e.organizer_id = $1
         OR e.booked_by = $1
         OR EXISTS (
           SELECT 1 FROM tbl_event_details personal_detail
           WHERE personal_detail.event_id = e._id
             AND personal_detail.attendee_user_id = $1
             AND personal_detail.is_deleted IS NOT TRUE
         )
       ))
     )
   ORDER BY start_at, e._id`,
  [principalId, role, roomId || null, rangeStart, rangeEnd, allEvents, floors || null]
)).rows;

export const findEventAccess = async (eventId, principalId) => (await query(
  `SELECT
     ${eventInstantColumns},
     EXISTS (
       SELECT 1 FROM tbl_event_details d
       WHERE d.event_id = e._id
         AND d.attendee_user_id = $2
         AND d.is_deleted IS NOT TRUE
     ) AS is_attendee,
     ARRAY(
       SELECT DISTINCT lower(btrim(room.floor))
       FROM tbl_event_details d
       JOIN tbl_users room ON room._id = d.room_id
       WHERE d.event_id = e._id
         AND d.is_deleted IS NOT TRUE
         AND room.type = 'room'
     ) AS room_floors
   FROM tbl_events e
   WHERE e._id = $1
   LIMIT 1`,
  [eventId, principalId]
)).rows[0] || null;

export const listEventParticipants = async (eventId, client = { query }) => (await client.query(
  `SELECT
     d._id,
     d.event_id,
     d.attendee_email,
     d.is_visitor,
     d.attendee_user_id,
     d.room_id,
     d.visitor_email
   FROM tbl_event_details d
   WHERE d.event_id = $1 AND d.is_deleted IS NOT TRUE
   ORDER BY d.created_at, d._id`,
  [eventId]
)).rows;

export const findEventAudience = async (eventIds) => {
  const ids = [...new Set((eventIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  return (await query(
    `SELECT DISTINCT audience.kind, audience.id
     FROM (
       SELECT 'user'::text AS kind, e.organizer_id AS id
       FROM tbl_events e WHERE e._id = ANY($1::uuid[])
       UNION ALL
       SELECT 'user', e.booked_by
       FROM tbl_events e
       WHERE e._id = ANY($1::uuid[]) AND e.booked_by IS NOT NULL
       UNION ALL
       SELECT 'user', d.attendee_user_id
       FROM tbl_event_details d
       WHERE d.event_id = ANY($1::uuid[]) AND d.attendee_user_id IS NOT NULL AND d.is_deleted IS NOT TRUE
       UNION ALL
       SELECT 'room', d.room_id
       FROM tbl_event_details d
       WHERE d.event_id = ANY($1::uuid[]) AND d.room_id IS NOT NULL AND d.is_deleted IS NOT TRUE
     ) audience
     WHERE audience.id IS NOT NULL`,
    [ids]
  )).rows;
};

export const findMutationAudience = async (eventId, scope = "occurrence") => (await query(
  `WITH pivot AS (
     SELECT
       _id,
       series_id,
       occurrence_index
     FROM tbl_events
     WHERE _id = $1
   ), targets AS (
     SELECT e._id
     FROM tbl_events e, pivot p
     WHERE ($2 = 'occurrence' AND e._id = p._id)
        OR ($2 = 'series' AND p.series_id IS NOT NULL AND e.series_id = p.series_id)
        OR ($2 = 'following' AND p.series_id IS NOT NULL AND e.series_id = p.series_id AND e.occurrence_index >= p.occurrence_index)
   ), audience AS (
     SELECT 'user'::text AS kind, e.organizer_id AS id
     FROM tbl_events e JOIN targets t ON t._id = e._id
     UNION ALL
     SELECT 'user', e.booked_by
     FROM tbl_events e JOIN targets t ON t._id = e._id
     WHERE e.booked_by IS NOT NULL
     UNION ALL
     SELECT 'user', d.attendee_user_id
     FROM tbl_event_details d JOIN targets t ON t._id = d.event_id
     WHERE d.attendee_user_id IS NOT NULL AND d.is_deleted IS NOT TRUE
     UNION ALL
     SELECT 'room', d.room_id
     FROM tbl_event_details d JOIN targets t ON t._id = d.event_id
     WHERE d.room_id IS NOT NULL AND d.is_deleted IS NOT TRUE
   )
   SELECT DISTINCT
     kind,
     id
   FROM audience
   WHERE id IS NOT NULL`,
  [eventId, scope || "occurrence"]
)).rows;

export const findDetailEventId = async (detailId) => (await query(
  `SELECT event_id FROM tbl_event_details WHERE _id = $1 LIMIT 1`,
  [detailId]
)).rows[0]?.event_id || null;

export const findRoomConflicts = async (roomIds, occurrences) => {
  if (!roomIds.length || !occurrences.length) return [];
  const starts = occurrences.map((occurrence) => occurrence.start);
  const ends = occurrences.map((occurrence) => occurrence.end);
  return (await query(
    `SELECT
       er.room_id,
       e._id AS event_id,
       requested.start_at,
       requested.end_at
     FROM unnest($2::timestamptz[], $3::timestamptz[]) AS requested(start_at, end_at)
     JOIN tbl_event_rooms er
       ON er.active
      AND er.room_id = ANY($1::uuid[])
      AND er.occupied_at && tstzrange(requested.start_at, requested.end_at, '[)')
     JOIN tbl_events e ON e._id = er.event_id
     ORDER BY requested.start_at, er.room_id`,
    [roomIds, starts, ends]
  )).rows;
};

export const eventsForMutationScope = async (client, eventId, scope) => (await client.query(
  `WITH pivot AS (
     SELECT
       _id,
       series_id,
       occurrence_index
     FROM tbl_events
     WHERE _id = $1
   )
   SELECT ${eventInstantColumns}
   FROM tbl_events e, pivot p
   WHERE
     ($2 = 'occurrence' AND e._id = p._id)
     OR ($2 = 'series' AND p.series_id IS NOT NULL AND e.series_id = p.series_id)
     OR ($2 = 'following' AND p.series_id IS NOT NULL AND e.series_id = p.series_id AND e.occurrence_index >= p.occurrence_index)
   ORDER BY e.occurrence_index NULLS FIRST`,
  [eventId, scope]
)).rows;

export const deactivateEventRooms = (client, eventIds) => client.query(
  `UPDATE tbl_event_rooms SET active = false WHERE event_id = ANY($1::uuid[])`,
  [eventIds]
);

export const updateSeriesHeader = (client, seriesId, values) => client.query(
  `UPDATE tbl_event_series
   SET subject = $2, description = $3, timezone = $4, updated_at = now()
   WHERE _id = $1`,
  [seriesId, values.subject, values.description, values.timezone]
);

export const cancelSeries = (client, seriesId) => client.query(
  `UPDATE tbl_event_series SET is_cancel = true, updated_at = now() WHERE _id = $1`,
  [seriesId]
);

export const clearEventParticipants = (client, eventId) => client.query(
  `DELETE FROM tbl_event_details WHERE event_id = $1`,
  [eventId]
);

export const updateEventHeader = async (client, eventId, values) => (await client.query(
  `UPDATE tbl_events
   SET subject = COALESCE($2, subject),
       description = COALESCE($3, description),
       start_date = $4::timestamptz AT TIME ZONE $6,
       end_date = $5::timestamptz AT TIME ZONE $6,
       timezone = $6,
       is_exception = $7,
       updated_at = now()
   WHERE _id = $1
   RETURNING
     _id, organizer, subject, description,
     start_date AT TIME ZONE timezone AS start_at,
     end_date AT TIME ZONE timezone AS end_at,
     timezone, series_id, occurrence_index`,
  [eventId, values.subject || null, values.description ?? null, values.start, values.end, values.timezone, Boolean(values.isException)]
)).rows[0];

export const cancelEvents = async (client, ids) => (await client.query(
  `UPDATE tbl_events SET is_cancel = true, updated_at = now()
   WHERE _id = ANY($1::uuid[]) AND is_cancel IS NOT TRUE
   RETURNING _id, series_id, occurrence_index`,
  [ids]
)).rows;

export const deleteParticipantById = async (client, detailId) => (await client.query(
  `DELETE FROM tbl_event_details WHERE _id = $1
   RETURNING _id, event_id, attendee_email`,
  [detailId]
)).rows[0] || null;

export const findParticipantEvent = async (detailId) => (await query(
  `SELECT e._id, e.organizer_id, e.booked_by
   FROM tbl_event_details d
   JOIN tbl_events e ON e._id = d.event_id
   WHERE d._id = $1`,
  [detailId]
)).rows[0] || null;

export const eventCheckInContext = async (eventId, principalId, cardNumber, execute = query) => (await execute(
  `SELECT
     ${eventInstantColumns},
     s.time_of_event_start_soon AS early_minutes,
     s.not_checked_in_time_limit AS late_minutes,
     (
       e.organizer_id = $2
       OR EXISTS (
         SELECT 1 FROM tbl_event_details d
         WHERE d.event_id = e._id AND d.attendee_user_id = $2 AND d.is_deleted IS NOT TRUE
       )
     ) AS is_related,
     ARRAY(
       SELECT DISTINCT lower(btrim(room.floor))
       FROM tbl_event_details d
       JOIN tbl_users room ON room._id = d.room_id
       WHERE d.event_id = e._id
         AND d.is_deleted IS NOT TRUE
         AND room.type = 'room'
     ) AS room_floors,
     (
       EXISTS (SELECT 1 FROM tbl_card_masters c WHERE lower(c.card_number) = lower($3))
       OR EXISTS (
         SELECT 1
         FROM tbl_user_cards card
         WHERE card.user_id = $2
           AND card.status = 'active'
           AND lower(btrim(card.card_number)) = lower(btrim($3))
       )
     ) AS card_allowed
   FROM tbl_events e
   CROSS JOIN LATERAL (SELECT * FROM tbl_app_settings ORDER BY created_at LIMIT 1) s
   WHERE e._id = $1 AND e.is_cancel IS NOT TRUE
   FOR UPDATE OF e`,
  [eventId, principalId, cardNumber]
)).rows[0] || null;

export const markCheckedIn = async (eventId, execute = query) => (await execute(
  `UPDATE tbl_events SET checked_in = now(), updated_at = now()
   WHERE _id = $1 AND checked_in IS NULL
   RETURNING _id, checked_in`,
  [eventId]
)).rows[0] || null;

export const finishEventNow = async (eventId, execute = query) => (await execute(
  `UPDATE tbl_events
   SET end_date = now() AT TIME ZONE timezone, updated_at = now()
   WHERE _id = $1
   RETURNING _id, end_date AT TIME ZONE timezone AS end_at`,
  [eventId]
)).rows[0] || null;

export const findRoomFloors = async (roomIds, client = { query }) => {
  if (!roomIds.length) return [];
  return (await client.query(
    `SELECT _id, name, floor
     FROM tbl_users
     WHERE _id = ANY($1::uuid[])
       AND type = 'room'
       AND is_deleted IS NOT TRUE`,
    [roomIds]
  )).rows;
};

// Release the room booking of meetings that were not checked in by the late limit.
// The meeting stays in the attendees' calendars; only the room is freed.
export const releaseAbandonedRoomBookings = async (execute = query) => {
  const released = (await execute(
    `WITH settings AS (
       SELECT not_checked_in_time_limit AS limit_minutes
       FROM tbl_app_settings
       ORDER BY created_at
       LIMIT 1
     ),
     expired AS (
       SELECT event._id
       FROM tbl_events event
       CROSS JOIN settings setting
       WHERE event.checked_in IS NULL
         AND event.is_cancel IS NOT TRUE
         AND now() >= (event.start_date AT TIME ZONE event.timezone)
           + make_interval(mins => setting.limit_minutes)
       FOR UPDATE OF event SKIP LOCKED
     ),
     abandoned AS (
       UPDATE tbl_event_rooms room_booking
       SET active = false
       FROM expired
       WHERE room_booking.event_id = expired._id
         AND room_booking.active
       RETURNING room_booking.event_id
     )
     SELECT DISTINCT event_id FROM abandoned`,
    []
  )).rows;
  const eventIds = released.map((row) => row.event_id);
  if (eventIds.length) {
    await execute(
      `UPDATE tbl_event_details
       SET is_deleted = true
       WHERE event_id = ANY($1::uuid[])
         AND room_id IS NOT NULL
         AND is_deleted IS NOT TRUE`,
      [eventIds]
    );
  }
  return eventIds;
};

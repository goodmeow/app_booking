\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE tbl_events
  ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  ADD COLUMN series_id uuid,
  ADD COLUMN occurrence_index integer,
  ADD COLUMN original_start timestamp without time zone,
  ADD COLUMN is_exception boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT tbl_events_time_order CHECK (end_date > start_date);

CREATE TABLE tbl_event_series (
  _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES tbl_users (_id),
  subject character varying NOT NULL,
  description character varying NOT NULL DEFAULT '-',
  timezone text NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  interval_count integer NOT NULL CHECK (interval_count BETWEEN 1 AND 52),
  weekdays smallint[],
  recurrence_end_date date NOT NULL,
  is_cancel boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone
);

ALTER TABLE tbl_events
  ADD CONSTRAINT tbl_events_series_fk
    FOREIGN KEY (series_id) REFERENCES tbl_event_series (_id),
  ADD CONSTRAINT tbl_events_occurrence_identity
    CHECK (
      (series_id IS NULL AND occurrence_index IS NULL)
      OR (series_id IS NOT NULL AND occurrence_index IS NOT NULL AND occurrence_index >= 0)
    ),
  ADD CONSTRAINT tbl_events_series_occurrence_key
    UNIQUE (series_id, occurrence_index);

CREATE TABLE tbl_event_rooms (
  event_id uuid NOT NULL REFERENCES tbl_events (_id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES tbl_users (_id),
  occupied_at tstzrange NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (event_id, room_id),
  CONSTRAINT tbl_event_rooms_nonempty CHECK (NOT isempty(occupied_at)),
  CONSTRAINT tbl_event_rooms_no_overlap
    EXCLUDE USING gist (room_id WITH =, occupied_at WITH &&)
    WHERE (active)
);

CREATE OR REPLACE FUNCTION phase9_sync_event_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organizer_id IS NULL AND NEW.organizer IS NOT NULL THEN
    SELECT _id INTO NEW.organizer_id
    FROM tbl_users
    WHERE lower(email) = lower(NEW.organizer)
      AND type = 'employee'
      AND is_deleted IS NOT TRUE;
  END IF;

  IF NEW.organizer IS NULL AND NEW.organizer_id IS NOT NULL THEN
    SELECT email INTO NEW.organizer
    FROM tbl_users
    WHERE _id = NEW.organizer_id;
  END IF;

  NEW.original_start := COALESCE(NEW.original_start, NEW.start_date);
  RETURN NEW;
END
$$;

CREATE TRIGGER phase9_events_identity_trigger
BEFORE INSERT OR UPDATE OF organizer, organizer_id, start_date
ON tbl_events
FOR EACH ROW
EXECUTE FUNCTION phase9_sync_event_identity();

CREATE OR REPLACE FUNCTION phase9_sync_detail_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account tbl_users%ROWTYPE;
BEGIN
  IF NEW.attendee_user_id IS NULL AND NEW.room_id IS NULL AND NEW.visitor_email IS NULL THEN
    SELECT * INTO account
    FROM tbl_users
    WHERE lower(email) = lower(NEW.attendee_email)
      AND is_deleted IS NOT TRUE;

    IF FOUND AND account.type = 'room' THEN
      NEW.room_id := account._id;
    ELSIF FOUND AND account.type = 'employee' THEN
      NEW.attendee_user_id := account._id;
    ELSE
      NEW.visitor_email := lower(btrim(NEW.attendee_email));
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER phase9_detail_identity_trigger
BEFORE INSERT OR UPDATE OF attendee_email, attendee_user_id, room_id, visitor_email
ON tbl_event_details
FOR EACH ROW
EXECUTE FUNCTION phase9_sync_detail_identity();

CREATE OR REPLACE FUNCTION phase9_sync_event_room()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_event_id uuid;
  target_event_ids uuid[];
BEGIN
  IF TG_TABLE_NAME = 'tbl_events' THEN
    target_event_ids := ARRAY[COALESCE(NEW._id, OLD._id)];
  ELSIF TG_OP = 'UPDATE' AND OLD.event_id IS DISTINCT FROM NEW.event_id THEN
    target_event_ids := ARRAY[OLD.event_id, NEW.event_id];
  ELSIF TG_OP = 'DELETE' THEN
    target_event_ids := ARRAY[OLD.event_id];
  ELSE
    target_event_ids := ARRAY[NEW.event_id];
  END IF;

  FOREACH target_event_id IN ARRAY target_event_ids LOOP
    DELETE FROM tbl_event_rooms
    WHERE event_id = target_event_id;

    INSERT INTO tbl_event_rooms (event_id, room_id, occupied_at, active)
    SELECT
      e._id,
      d.room_id,
      tstzrange(
        e.start_date AT TIME ZONE e.timezone,
        e.end_date AT TIME ZONE e.timezone,
        '[)'
      ),
      e.is_cancel IS NOT TRUE AND d.is_deleted IS NOT TRUE
    FROM tbl_events e
    JOIN tbl_event_details d ON d.event_id = e._id
    WHERE e._id = target_event_id
      AND d.room_id IS NOT NULL
    ON CONFLICT (event_id, room_id) DO UPDATE
    SET occupied_at = EXCLUDED.occupied_at,
        active = EXCLUDED.active;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END
$$;

CREATE TRIGGER phase9_detail_room_trigger
AFTER INSERT OR UPDATE OR DELETE
ON tbl_event_details
FOR EACH ROW
EXECUTE FUNCTION phase9_sync_event_room();

CREATE TRIGGER phase9_event_room_trigger
AFTER UPDATE OF start_date, end_date, is_cancel
ON tbl_events
FOR EACH ROW
EXECUTE FUNCTION phase9_sync_event_room();

-- Materialize every pre-Phase-9 room reservation. The exclusion constraint
-- deliberately aborts migration if legacy data already contains overlaps.
INSERT INTO tbl_event_rooms (event_id, room_id, occupied_at, active)
SELECT DISTINCT
  e._id,
  d.room_id,
  tstzrange(
    e.start_date AT TIME ZONE e.timezone,
    e.end_date AT TIME ZONE e.timezone,
    '[)'
  ),
  e.is_cancel IS NOT TRUE AND d.is_deleted IS NOT TRUE
FROM tbl_events e
JOIN tbl_event_details d ON d.event_id = e._id
WHERE d.room_id IS NOT NULL
ON CONFLICT (event_id, room_id) DO UPDATE
SET occupied_at = EXCLUDED.occupied_at,
    active = EXCLUDED.active;

COMMIT;

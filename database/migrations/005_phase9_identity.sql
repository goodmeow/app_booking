\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tbl_users
    WHERE email IS NOT NULL
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize duplicate user emails';
  END IF;
END
$$;

UPDATE tbl_users
SET email = lower(btrim(email))
WHERE email IS NOT NULL;

ALTER TABLE tbl_users
  ADD COLUMN username character varying;

CREATE UNIQUE INDEX tbl_users_email_lower_key
  ON tbl_users (lower(email));

CREATE UNIQUE INDEX tbl_users_username_lower_key
  ON tbl_users (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE tbl_users
  ADD CONSTRAINT tbl_users_email_present
    CHECK (email IS NOT NULL AND btrim(email) <> '' AND position('@' IN email) > 1),
  ADD CONSTRAINT tbl_users_username_present
    CHECK (username IS NULL OR (btrim(username) <> '' AND position('@' IN username) = 0)),
  ADD CONSTRAINT tbl_users_type_check
    CHECK (type IN ('employee', 'room')),
  ADD CONSTRAINT tbl_users_role_fk
    FOREIGN KEY (role_id) REFERENCES tbl_role (_id);

ALTER TABLE tbl_events
  ADD COLUMN organizer_id uuid;

UPDATE tbl_events e
SET organizer_id = u._id
FROM tbl_users u
WHERE lower(u.email) = lower(e.organizer);

ALTER TABLE tbl_events
  ADD CONSTRAINT tbl_events_organizer_fk
    FOREIGN KEY (organizer_id) REFERENCES tbl_users (_id);

ALTER TABLE tbl_event_details
  ADD COLUMN attendee_user_id uuid,
  ADD COLUMN room_id uuid,
  ADD COLUMN visitor_email character varying;

UPDATE tbl_event_details d
SET attendee_user_id = u._id
FROM tbl_users u
WHERE lower(u.email) = lower(d.attendee_email)
  AND u.type = 'employee';

UPDATE tbl_event_details d
SET room_id = u._id
FROM tbl_users u
WHERE lower(u.email) = lower(d.attendee_email)
  AND u.type = 'room';

UPDATE tbl_event_details d
SET visitor_email = lower(btrim(d.attendee_email))
WHERE d.attendee_user_id IS NULL
  AND d.room_id IS NULL;

ALTER TABLE tbl_event_details
  ADD CONSTRAINT tbl_event_details_event_fk
    FOREIGN KEY (event_id) REFERENCES tbl_events (_id) ON DELETE CASCADE,
  ADD CONSTRAINT tbl_event_details_user_fk
    FOREIGN KEY (attendee_user_id) REFERENCES tbl_users (_id),
  ADD CONSTRAINT tbl_event_details_room_fk
    FOREIGN KEY (room_id) REFERENCES tbl_users (_id),
  ADD CONSTRAINT tbl_event_details_identity_check
    CHECK (num_nonnulls(attendee_user_id, room_id, visitor_email) = 1);

CREATE INDEX tbl_event_details_event_idx
  ON tbl_event_details (event_id)
  WHERE is_deleted IS NOT TRUE;

CREATE INDEX tbl_event_details_user_idx
  ON tbl_event_details (attendee_user_id)
  WHERE is_deleted IS NOT TRUE;

CREATE INDEX tbl_event_details_room_idx
  ON tbl_event_details (room_id)
  WHERE is_deleted IS NOT TRUE;

COMMIT;

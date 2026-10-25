\set ON_ERROR_STOP on

BEGIN;

UPDATE tbl_users
SET role_id = NULL
WHERE type = 'room'
  AND role_id IS NOT NULL;

ALTER TABLE tbl_users
  ADD CONSTRAINT tbl_users_room_role_check
    CHECK (type <> 'room' OR role_id IS NULL);

COMMIT;

\set ON_ERROR_STOP on

-- A front-desk account may cover more than one floor. `floor` stays as the
-- legacy single value; `floors` is the authoritative list when it is non-empty.
BEGIN;

ALTER TABLE tbl_users
  ADD COLUMN IF NOT EXISTS floors text[] NOT NULL DEFAULT '{}';

UPDATE tbl_users
SET floors = ARRAY[btrim(floor)]
WHERE type = 'employee'
  AND floor IS NOT NULL
  AND btrim(floor) <> ''
  AND cardinality(floors) = 0;

CREATE INDEX IF NOT EXISTS tbl_users_floors_idx
  ON tbl_users USING GIN (floors);

COMMIT;

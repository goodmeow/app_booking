-- Accounts created by the bulk import (and any password reset by an admin)
-- must replace the known default before using the rest of the API.
--
-- Existing accounts keep false so the migration does not log everybody out or
-- force a change on a normal deployment.
BEGIN;

ALTER TABLE tbl_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMIT;

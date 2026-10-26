\set ON_ERROR_STOP on

-- The first admin created by /setup is the bootstrap account. It must stay
-- available so an operator can always recover the CMS, even if every other
-- admin is deleted or demoted.
BEGIN;

ALTER TABLE tbl_users
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

-- Existing installations already have a setup admin before this column
-- existed. Mark the oldest admin as the protected one. A fresh database has no
-- admin yet; insertFirstAdmin() sets the flag when setup creates it.
UPDATE tbl_users u
SET is_protected = true
WHERE u._id = (
  SELECT candidate._id
  FROM tbl_users candidate
  JOIN tbl_role r ON r._id = candidate.role_id
  WHERE lower(r.role_name) = 'admin'
    AND candidate.is_deleted IS NOT TRUE
  ORDER BY candidate.created_at, candidate._id
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM tbl_users protected
  WHERE protected.is_protected IS TRUE
);

COMMIT;

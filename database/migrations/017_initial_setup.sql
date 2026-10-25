\set ON_ERROR_STOP on

-- A brand-new deployment has no account at all, so nobody can sign in to
-- create the first admin. The setup page creates that account once, and the
-- flag below locks the page afterwards.
--
-- Databases that already have an active admin are marked as completed by this
-- migration, so an upgraded installation never shows the bootstrap form again.
BEGIN;

ALTER TABLE tbl_app_settings
  ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

UPDATE tbl_app_settings
SET setup_completed = true
WHERE EXISTS (
  SELECT 1
  FROM tbl_users u
  JOIN tbl_role r ON r._id = u.role_id
  WHERE lower(r.role_name) = 'admin'
    AND u.is_deleted IS NOT TRUE
);

COMMIT;

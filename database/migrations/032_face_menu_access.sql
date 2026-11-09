\set ON_ERROR_STOP on

-- The Face menu is only offered while the face service is reachable; the server
-- removes it from /access/menus when the probe fails. This migration adds the
-- key to the matrix and gives it to admin by default. super_admin is implicit
-- and never gets a row here.
BEGIN;

-- 022 created the CHECK constraint inline, so it carries the default name.
ALTER TABLE tbl_role_menu_access
  DROP CONSTRAINT IF EXISTS tbl_role_menu_access_menu_key_check;

ALTER TABLE tbl_role_menu_access
  ADD CONSTRAINT tbl_role_menu_access_menu_key_check
  CHECK (menu_key IN ('calendar', 'report', 'users', 'rooms', 'devices', 'settings', 'face'));

INSERT INTO tbl_role_menu_access (role_id, menu_key, allowed)
SELECT _id, 'face', true
FROM tbl_role
WHERE lower(role_name) = 'admin'
  AND is_deleted IS NOT TRUE
ON CONFLICT (role_id, menu_key) DO UPDATE
SET allowed = EXCLUDED.allowed,
    updated_at = now();

COMMIT;

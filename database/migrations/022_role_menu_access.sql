\set ON_ERROR_STOP on

-- CMS menu access is controlled per role from Management > Settings. The first
-- account created by /setup is promoted to super_admin, the only role that can
-- change the matrix, and it always keeps every menu.
BEGIN;

INSERT INTO tbl_role (_id, role_name, is_deleted)
VALUES ('a1e5d7c9-2b64-4f38-9a10-7c3d5e8f6b21', 'super_admin', false)
ON CONFLICT (_id) DO UPDATE
SET role_name = EXCLUDED.role_name,
    is_deleted = EXCLUDED.is_deleted;

-- Existing installations already marked their setup account as protected.
UPDATE tbl_users
SET role_id = (
  SELECT _id
  FROM tbl_role
  WHERE lower(role_name) = 'super_admin'
    AND is_deleted IS NOT TRUE
  LIMIT 1
)
WHERE is_protected IS TRUE;

-- A database restored from a dump may not carry the protected flag. Promote
-- the oldest admin so the matrix is always editable after the upgrade.
UPDATE tbl_users u
SET role_id = (
  SELECT _id
  FROM tbl_role
  WHERE lower(role_name) = 'super_admin'
    AND is_deleted IS NOT TRUE
  LIMIT 1
)
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
  FROM tbl_users super_admin_user
  JOIN tbl_role super_admin_role ON super_admin_role._id = super_admin_user.role_id
  WHERE lower(super_admin_role.role_name) = 'super_admin'
    AND super_admin_user.is_deleted IS NOT TRUE
);

CREATE TABLE IF NOT EXISTS tbl_role_menu_access (
  role_id uuid NOT NULL REFERENCES tbl_role (_id) ON DELETE CASCADE,
  menu_key varchar(32) NOT NULL CHECK (menu_key IN
    ('calendar', 'report', 'users', 'rooms', 'devices', 'settings')),
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, menu_key)
);

-- Defaults preserve the old behaviour: admin sees everything, everyone else
-- still opens the calendar. The front desk gains more menus from the matrix.
WITH menus (menu_key) AS (
  VALUES ('calendar'), ('report'), ('users'), ('rooms'), ('devices'), ('settings')
),
roles (role_name, allowed_all) AS (
  VALUES ('super_admin', true), ('admin', true), ('receptionist', false), ('user', false)
)
INSERT INTO tbl_role_menu_access (role_id, menu_key, allowed)
SELECT r._id, m.menu_key, roles.allowed_all OR m.menu_key = 'calendar'
FROM tbl_role r
JOIN roles ON lower(r.role_name) = roles.role_name
CROSS JOIN menus m
WHERE r.is_deleted IS NOT TRUE
ON CONFLICT (role_id, menu_key) DO NOTHING;

COMMIT;

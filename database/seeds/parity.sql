\set ON_ERROR_STOP on

BEGIN;

INSERT INTO tbl_role (_id, role_name, is_deleted)
VALUES ('67e9500b-908a-497d-9d3b-54bc020700cb', 'user', false)
ON CONFLICT (_id) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  is_deleted = EXCLUDED.is_deleted;

UPDATE tbl_users
SET password = '$2b$10$uwn2Il15fmNVJ7nhgiz6ceQWgPJC9EsDWNH7SsxtbwOLxBlpxd/S.'
WHERE email IN ('admin@example.test', 'user@example.test');

COMMIT;

SELECT 'parity seed: ok' AS result;

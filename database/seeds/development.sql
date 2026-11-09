\set ON_ERROR_STOP on

BEGIN;

TRUNCATE TABLE
  tbl_audit_log,
  tbl_role_menu_access,
  tbl_kiosk_devices,
  tbl_user_cards,
  tbl_event_rooms,
  tbl_event_details,
  tbl_events,
  tbl_event_series,
  tbl_card_masters,
  tbl_app_settings,
  tbl_rooms,
  tbl_users,
  tbl_role;

-- The receptionist role is part of the schema (015_receptionist_on_behalf.sql),
-- but this seed truncates tbl_role, so the role has to be inserted again here.
-- No demo account uses it by default; a receptionist is created through the CMS
-- or by a regression test.
INSERT INTO tbl_role (_id, role_name, is_deleted) VALUES
  ('a1e5d7c9-2b64-4f38-9a10-7c3d5e8f6b21', 'super_admin', false),
  ('471ba030-c950-41f9-90da-4e0fe10426a6', 'admin', false),
  ('67e9500b-908a-497d-9d3b-54bc020700cb', 'user', false),
  ('3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73', 'receptionist', false);

INSERT INTO tbl_role_menu_access (role_id, menu_key, allowed)
SELECT r._id, m.menu_key,
       lower(r.role_name) IN ('super_admin', 'admin') OR m.menu_key = 'calendar'
FROM tbl_role r
CROSS JOIN (VALUES ('calendar'), ('report'), ('users'), ('rooms'), ('devices'), ('settings')) AS m(menu_key);

INSERT INTO tbl_users
  (_id, name, email, password, role_id, employee_id, is_deleted, type)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'Test Admin',
    'admin@example.test',
    '$2b$10$uwn2Il15fmNVJ7nhgiz6ceQWgPJC9EsDWNH7SsxtbwOLxBlpxd/S.',
    '471ba030-c950-41f9-90da-4e0fe10426a6',
    'EMP-ADMIN',
    false,
    'employee'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Test User',
    'user@example.test',
    '$2b$10$uwn2Il15fmNVJ7nhgiz6ceQWgPJC9EsDWNH7SsxtbwOLxBlpxd/S.',
    '67e9500b-908a-497d-9d3b-54bc020700cb',
    'EMP-USER',
    false,
    'employee'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Privacy Viewer',
    'viewer@example.test',
    '$2b$10$uwn2Il15fmNVJ7nhgiz6ceQWgPJC9EsDWNH7SsxtbwOLxBlpxd/S.',
    '67e9500b-908a-497d-9d3b-54bc020700cb',
    'EMP-VIEWER',
    false,
    'employee'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    'Test Room One',
    'room-one@room.com',
    '$2b$12$8BJv0ozFONflhmYT7NGXbuNHtzoWx.BfGd8kg2SyGg9b.WgHk2T26',
    NULL,
    NULL,
    false,
    'room'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'Test Room Two',
    'room-two@room.com',
    '$2b$12$8BJv0ozFONflhmYT7NGXbuNHtzoWx.BfGd8kg2SyGg9b.WgHk2T26',
    NULL,
    NULL,
    false,
    'room'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'Test Room Three',
    'room-three@room.com',
    '$2b$12$8BJv0ozFONflhmYT7NGXbuNHtzoWx.BfGd8kg2SyGg9b.WgHk2T26',
    NULL,
    NULL,
    false,
    'room'
  );

-- Employee cards live in tbl_user_cards now; the legacy tbl_users.card_number
-- column is no longer written by the seed. The UIDs are demo values.
INSERT INTO tbl_user_cards (_id, user_id, card_number, status)
VALUES
  (
    '51000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'TEST-ADMIN-CARD',
    'active'
  ),
  (
    '51000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'TEST-USER-CARD',
    'active'
  ),
  (
    '51000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'TEST-VIEWER-CARD',
    'active'
  )
ON CONFLICT DO NOTHING;

UPDATE tbl_users SET
  floor = '1',
  capacity = '8',
  building = 'Test Building',
  feature = 'Display,NFC'
WHERE type = 'room';

-- Working floor of each employee (used by the per-floor booking rule).
UPDATE tbl_users SET floor = '1'
WHERE type = 'employee';

UPDATE tbl_users SET floor = '2' WHERE email = 'room-two@room.com';
UPDATE tbl_users SET floor = '3' WHERE email = 'room-three@room.com';

INSERT INTO tbl_app_settings (
  _id,
  lock_timer,
  led_timer,
  table_input,
  not_checked_in_time_limit,
  time_of_event_start_soon,
  available_color,
  will_start_color,
  on_meeting_color
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  5,
  5,
  true,
  15,
  10,
  '05',
  '08',
  '04'
);

INSERT INTO tbl_card_masters
  (_id, card_number, created_by)
VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    'TEST-MASTER-CARD',
    '20000000-0000-4000-8000-000000000001'
  );

INSERT INTO tbl_events (
  _id,
  organizer,
  location,
  subject,
  description,
  start_date,
  end_date,
  is_cancel,
  is_draft,
  is_allday,
  late_threshold
) VALUES (
  '60000000-0000-4000-8000-000000000001',
  'admin@example.test',
  'room-one@room.com',
  'Test Meeting',
  'Sanitized database fixture',
  '2030-01-15 10:00:00',
  '2030-01-15 11:00:00',
  false,
  false,
  false,
  15
);

INSERT INTO tbl_event_details
  (_id, event_id, attendee_email, is_deleted, is_visitor)
VALUES
  (
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'user@example.test',
    false,
    false
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    'room-one@room.com',
    false,
    false
  );

COMMIT;

SELECT 'development seed: ok' AS result;

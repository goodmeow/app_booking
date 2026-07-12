\set ON_ERROR_STOP on

BEGIN;

TRUNCATE TABLE
  tbl_event_details,
  tbl_events,
  tbl_card_masters,
  tbl_app_settings,
  tbl_rooms,
  tbl_users,
  tbl_role;

INSERT INTO tbl_role (_id, role_name, is_deleted) VALUES
  ('471ba030-c950-41f9-90da-4e0fe10426a6', 'admin', false),
  ('67e9500b-908a-497d-9d3b-54bc020700cb', 'user', false);

INSERT INTO tbl_users
  (_id, name, email, password, role_id, is_deleted, type, card_number)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'Test Admin',
    'admin@example.test',
    '$2b$10$test.hash.not.for.authentication',
    '471ba030-c950-41f9-90da-4e0fe10426a6',
    false,
    'employee',
    'TEST-ADMIN-CARD'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Test User',
    'user@example.test',
    '$2b$10$test.hash.not.for.authentication',
    '67e9500b-908a-497d-9d3b-54bc020700cb',
    false,
    'employee',
    'TEST-USER-CARD'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    'Test Room One',
    'room-one@room.com',
    NULL,
    NULL,
    false,
    'room',
    NULL
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'Test Room Two',
    'room-two@room.com',
    NULL,
    NULL,
    false,
    'room',
    NULL
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'Test Room Three',
    'room-three@room.com',
    NULL,
    NULL,
    false,
    'room',
    NULL
  );

UPDATE tbl_users SET
  floor = '1',
  capacity = '8',
  building = 'Test Building',
  feature = 'Display,NFC'
WHERE type = 'room';

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

\set ON_ERROR_STOP on

DO $$
DECLARE
  actual_count integer;
  employee_role_id uuid;
  room_user_id uuid;
BEGIN
  SELECT count(*) INTO actual_count
  FROM pg_tables
  WHERE schemaname = 'public';

  IF actual_count < 10 THEN
    RAISE EXCEPTION 'Expected at least 10 public tables, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';

  IF actual_count < 31 THEN
    RAISE EXCEPTION 'Expected Phase 9 functions, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'public';

  IF actual_count < 20 THEN
    RAISE EXCEPTION 'Expected Phase 9 constraints, found %', actual_count;
  END IF;

  IF to_regclass('public.tbl_event_series') IS NULL
     OR to_regclass('public.tbl_event_rooms') IS NULL THEN
    RAISE EXCEPTION 'Phase 9 scheduler tables are missing';
  END IF;

  IF to_regclass('public.tbl_kiosk_devices') IS NULL THEN
    RAISE EXCEPTION 'Phase 10A kiosk device table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tbl_kiosk_devices'
      AND column_name IN ('nfc_enabled', 'led_enabled', 'show_subject')
    GROUP BY table_schema, table_name
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'Kiosk capability columns are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tbl_kiosk_devices'::regclass
      AND conname IN (
        'tbl_kiosk_devices_room_fk',
        'tbl_kiosk_devices_revoked_by_fk',
        'tbl_kiosk_devices_token_version_positive'
      )
    GROUP BY conrelid
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'Kiosk device constraints are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'tbl_kiosk_devices_active_room_idx'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'tbl_kiosk_devices_refresh_token_hash_idx'
  ) THEN
    RAISE EXCEPTION 'Kiosk device indexes are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'tbl_users_email_lower_key'
  ) THEN
    RAISE EXCEPTION 'Normalized email uniqueness is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tbl_users'::regclass
      AND conname = 'tbl_users_room_role_check'
  ) THEN
    RAISE EXCEPTION 'Room role separation constraint is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tbl_users
    WHERE type = 'room'
      AND role_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Seeded room users must not have employee roles';
  END IF;

  SELECT _id INTO room_user_id
  FROM tbl_users
  WHERE type = 'room'
  ORDER BY _id
  LIMIT 1;

  SELECT role_id INTO employee_role_id
  FROM tbl_users
  WHERE type = 'employee'
    AND role_id IS NOT NULL
  ORDER BY _id
  LIMIT 1;

  IF room_user_id IS NULL OR employee_role_id IS NULL THEN
    RAISE EXCEPTION 'Expected seeded room and employee role data';
  END IF;

  BEGIN
    UPDATE tbl_users
    SET role_id = employee_role_id
    WHERE _id = room_user_id;

    RAISE EXCEPTION 'Room user accepted an employee role';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  IF EXISTS (
    SELECT 1
    FROM tbl_users
    WHERE _id = room_user_id
      AND role_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Rejected room role mutation was persisted';
  END IF;
END
$$;

SELECT 'schema smoke: ok' AS result;

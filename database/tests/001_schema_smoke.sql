\set ON_ERROR_STOP on

DO $$
DECLARE
  actual_count integer;
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
      AND column_name IN ('nfc_enabled', 'led_enabled')
    GROUP BY table_schema, table_name
    HAVING count(*) = 2
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
END
$$;

SELECT 'schema smoke: ok' AS result;

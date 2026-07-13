\set ON_ERROR_STOP on

DO $$
DECLARE
  actual_count integer;
BEGIN
  SELECT count(*) INTO actual_count
  FROM pg_tables
  WHERE schemaname = 'public';

  IF actual_count < 9 THEN
    RAISE EXCEPTION 'Expected at least 9 public tables, found %', actual_count;
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

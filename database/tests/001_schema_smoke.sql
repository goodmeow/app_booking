\set ON_ERROR_STOP on

DO $$
DECLARE
  actual_count integer;
BEGIN
  SELECT count(*) INTO actual_count
  FROM pg_tables
  WHERE schemaname = 'public';

  IF actual_count <> 7 THEN
    RAISE EXCEPTION 'Expected 7 public tables, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';

  IF actual_count <> 28 THEN
    RAISE EXCEPTION 'Expected 28 public functions, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'public';

  IF actual_count <> 9 THEN
    RAISE EXCEPTION 'Expected 9 public constraints, found %', actual_count;
  END IF;
END
$$;

SELECT 'schema smoke: ok' AS result;

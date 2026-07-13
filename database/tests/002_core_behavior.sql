\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  actual_text text;
  actual_count integer;
  actual_uuid uuid;
BEGIN
  SELECT card_master_validation('test-master-card') INTO actual_text;
  IF actual_text <> 'Door Opened' THEN
    RAISE EXCEPTION 'Unexpected card validation result: %', actual_text;
  END IF;

  BEGIN
    PERFORM card_master_validation('UNKNOWN-CARD');
    RAISE EXCEPTION 'Unknown card unexpectedly accepted';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'Card not registered' THEN
        RAISE;
      END IF;
  END;

  SELECT count(*) INTO actual_count
  FROM settings_get_data('', '', '', '');
  IF actual_count <> 1 THEN
    RAISE EXCEPTION 'Expected one settings row, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM users_list('', '', '', '');
  IF actual_count <> 3 THEN
    RAISE EXCEPTION 'Expected three active employees, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM room_list('', '', '', '');
  IF actual_count <> 3 THEN
    RAISE EXCEPTION 'Expected three active rooms, found %', actual_count;
  END IF;

  SELECT _id INTO actual_uuid
  FROM events_checkin(
    '60000000-0000-4000-8000-000000000001',
    'TEST-MASTER-CARD'
  );
  IF actual_uuid IS NULL THEN
    RAISE EXCEPTION 'Valid master card did not check in event';
  END IF;

  BEGIN
    PERFORM event_early_finished('60000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Future event was finished before its start time';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  SELECT events_delete_events(
    'admin@example.test',
    '60000000-0000-4000-8000-000000000001'
  ) INTO actual_text;
  IF actual_text <> 'Success deleted data' THEN
    RAISE EXCEPTION 'Organizer cancellation failed: %', actual_text;
  END IF;
END
$$;

ROLLBACK;

SELECT 'core behavior: ok' AS result;

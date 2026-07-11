\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  expected_names text[] := ARRAY[
    'card_master_delete_data',
    'card_master_get_data',
    'card_master_insert_data',
    'card_master_update_data',
    'card_master_validation',
    'event_details_delete_data',
    'event_details_list_data',
    'event_details_new_attendee',
    'event_early_finished',
    'events_checkin',
    'events_delete_attendee',
    'events_delete_events',
    'events_insert_data',
    'events_list_data_by_attendee',
    'events_list_data_by_organizer',
    'events_update_data',
    'events_update_data_old',
    'report_rooms_usage',
    'room_available_list',
    'room_detail',
    'room_list',
    'settings_get_data',
    'settings_update',
    'users_detail',
    'users_insert_data',
    'users_list',
    'users_list_data',
    'users_update_data'
  ];
  actual_names text[];
  actual_count integer;
  actual_text text;
  temporary_id uuid;
  inserted_event_id uuid;
BEGIN
  SELECT array_agg(p.proname ORDER BY p.proname)
  INTO actual_names
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';

  IF actual_names <> expected_names THEN
    RAISE EXCEPTION 'Stored function inventory mismatch';
  END IF;

  SELECT count(*) INTO actual_count
  FROM card_master_get_data('', '', '', '');
  IF actual_count <> 1 THEN
    RAISE EXCEPTION 'card_master_get_data expected 1 row, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM event_details_list_data(
    'WHERE e._id = ''60000000-0000-4000-8000-000000000001''',
    '',
    '',
    ''
  );
  IF actual_count <> 2 THEN
    RAISE EXCEPTION 'event_details_list_data expected 2 rows, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM events_list_data_by_attendee(
    'WHERE u.email = ''user@example.test''',
    '',
    '',
    ''
  );
  IF actual_count <> 1 THEN
    RAISE EXCEPTION 'attendee event list expected 1 row, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM events_list_data_by_organizer(
    'WHERE u.email = ''admin@example.test''',
    '',
    '',
    ''
  );
  IF actual_count <> 1 THEN
    RAISE EXCEPTION 'organizer event list expected 1 row, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM report_rooms_usage('2030-01-01', '2030-01-31');
  IF actual_count <> 3 THEN
    RAISE EXCEPTION 'room report expected 3 rows, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM room_available_list(
    'WHERE (e.start_date BETWEEN ''2030-01-15 10:15'' AND ''2030-01-15 10:30'' OR e.end_date BETWEEN ''2030-01-15 10:15'' AND ''2030-01-15 10:30'')',
    '',
    '',
    ''
  );
  -- Legacy overlap predicate misses an existing event that fully contains the
  -- requested interval, so all three rooms are returned.
  IF actual_count <> 3 THEN
    RAISE EXCEPTION 'legacy available room list expected 3 rows, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM room_detail(
    'WHERE email = ''room-one@room.com''',
    '',
    '',
    ''
  );
  IF actual_count <> 1 THEN
    RAISE EXCEPTION 'room_detail expected 1 row, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM users_detail(
    'WHERE u.email = ''admin@example.test''',
    '',
    '',
    ''
  );
  IF actual_count <> 1 THEN
    RAISE EXCEPTION 'users_detail expected 1 row, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM users_list_data('', '', '', '');
  IF actual_count <> 2 THEN
    RAISE EXCEPTION 'users_list_data expected 2 rows, found %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM settings_update(
    '{
      "id":"40000000-0000-4000-8000-000000000001",
      "lock_timer":6,
      "led_timer":7,
      "table_input":false,
      "not_checked_in_time_limit":20,
      "time_of_event_start_soon":12,
      "available_color":"05",
      "will_start_color":"08",
      "on_meeting_color":"04"
    }'::jsonb
  );
  IF actual_count <> 3 THEN
    RAISE EXCEPTION 'settings_update expected 3 room recipients, found %', actual_count;
  END IF;

  SELECT id INTO temporary_id
  FROM card_master_insert_data(
    'TEMP-MASTER-CARD',
    '20000000-0000-4000-8000-000000000001'
  );
  IF temporary_id IS NULL THEN
    RAISE EXCEPTION 'card_master_insert_data returned no id';
  END IF;

  PERFORM card_master_update_data(
    temporary_id::text,
    'TEMP-MASTER-CARD-UPDATED',
    '20000000-0000-4000-8000-000000000001'
  );
  SELECT card_master_delete_data(temporary_id::text) INTO actual_text;
  IF actual_text <> 'Success delete card master' THEN
    RAISE EXCEPTION 'card_master_delete_data failed: %', actual_text;
  END IF;

  PERFORM event_details_new_attendee(
    '(event_id, attendee_email, is_visitor)',
    '(''60000000-0000-4000-8000-000000000001'', ''visitor@example.test'', true)'
  );

  SELECT id INTO inserted_event_id
  FROM events_insert_data(
    '{organizer,subject,description,start_date,end_date,attendee_email,is_visitor}',
    ARRAY[[
      'admin@example.test',
      'Inserted Contract Event',
      'Generated inside rollback test',
      '2030-02-01 10:00:00',
      '2030-02-01 11:00:00',
      'room-two@room.com',
      'false'
    ]]::character varying[]
  )
  LIMIT 1;
  IF inserted_event_id IS NULL THEN
    RAISE EXCEPTION 'events_insert_data returned no event';
  END IF;

  PERFORM events_update_data(
    jsonb_build_object(
      'id', inserted_event_id,
      'organizer', 'admin@example.test',
      'subject', 'Updated Contract Event',
      'description', 'Updated inside rollback test',
      'start_date', '2030-02-01 10:30:00',
      'end_date', '2030-02-01 11:30:00'
    ),
    '[{"attendee_email":"room-two@room.com","is_visitor":false}]'::jsonb
  );

  PERFORM users_insert_data(
    ARRAY['name', 'email', 'password', 'role_id', 'is_deleted', 'type'],
    ARRAY[[
      'Temporary User',
      'temporary@example.test',
      'test-only',
      '10000000-0000-4000-8000-000000000002',
      'false',
      'employee'
    ]]::character varying[]
  );

  PERFORM users_update_data(
    '[{"column_name":"name","column_value":"Temporary User Updated"}]'::jsonb,
    '[{"column_name":"email","operator":"=","column_value":"temporary@example.test"}]'::jsonb
  );

  -- Known legacy defect: filtered branch references undefined alias `i`.
  BEGIN
    PERFORM users_list(
      'WHERE LOWER(u.name) LIKE LOWER(''%Temporary%'')',
      '',
      '',
      ''
    );
    RAISE EXCEPTION 'users_list filtered legacy defect unexpectedly absent';
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  -- Deprecated/broken functions remain present for parity; modern replacements
  -- are covered above. Their signatures are asserted in expected_names.
END
$$;

ROLLBACK;

SELECT 'function contracts: ok' AS result;

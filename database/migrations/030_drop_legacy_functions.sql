\set ON_ERROR_STOP on

BEGIN;

-- The server never calls the legacy bjb.sql functions any more: every data
-- access goes through the SQL repositories in server/features. Migration 004 is
-- already recorded in schema_migrations on installed databases, so removing the
-- file does not remove the functions; this migration drops them.
-- PostgreSQL identifies a function by name plus signature, so resolve each name
-- to its pg_proc entry and drop whatever signature it currently has.
DO $$
DECLARE
  legacy_function record;
BEGIN
  FOR legacy_function IN
    SELECT procedure_catalog.oid
    FROM pg_proc procedure_catalog
    JOIN pg_namespace procedure_namespace
      ON procedure_namespace.oid = procedure_catalog.pronamespace
    WHERE procedure_namespace.nspname = 'public'
      AND procedure_catalog.proname = ANY (ARRAY[
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
      ])
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', legacy_function.oid::regprocedure);
  END LOOP;
END
$$;

COMMIT;

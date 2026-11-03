\set ON_ERROR_STOP on

-- A timezone change changes the instant represented by the same local wall
-- clock. The room-occupancy trigger must recalculate occupied_at for that case
-- too, otherwise conflict checks and availability use a stale range.
BEGIN;

DROP TRIGGER IF EXISTS phase9_event_room_trigger ON tbl_events;

CREATE TRIGGER phase9_event_room_trigger
AFTER UPDATE OF start_date, end_date, timezone, is_cancel
ON tbl_events
FOR EACH ROW
EXECUTE FUNCTION phase9_sync_event_room();

COMMIT;

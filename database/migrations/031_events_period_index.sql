\set ON_ERROR_STOP on

BEGIN;

-- The calendar reads one time range and filters with the same expression the
-- room trigger materialises, so index the range instead of the raw columns.
CREATE INDEX IF NOT EXISTS tbl_events_period_idx
  ON tbl_events
  USING gist (
    tstzrange(
      start_date AT TIME ZONE timezone,
      end_date AT TIME ZONE timezone,
      '[)'
    )
  );

COMMIT;

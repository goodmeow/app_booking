\set ON_ERROR_STOP on

-- The monthly cadence joins the Recurring booking type (One Time / Recurring
-- with daily/weekly/monthly patterns). The old constraint only accepted
-- daily/weekly, so creating a monthly series failed with a 500 (23514).
BEGIN;

ALTER TABLE tbl_event_series
  DROP CONSTRAINT tbl_event_series_cadence_check,
  ADD CONSTRAINT tbl_event_series_cadence_check
    CHECK (cadence IN ('daily', 'weekly', 'monthly'));

COMMIT;

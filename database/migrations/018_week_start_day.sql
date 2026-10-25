\set ON_ERROR_STOP on

-- The calendar grid and its weekly query must agree on the first day of the
-- week. Default Monday matches the bundled id/en-gb locales.
BEGIN;

ALTER TABLE tbl_app_settings
  ADD COLUMN IF NOT EXISTS week_start_day integer NOT NULL DEFAULT 1;

ALTER TABLE tbl_app_settings
  DROP CONSTRAINT IF EXISTS tbl_app_settings_week_start_day_check;

ALTER TABLE tbl_app_settings
  ADD CONSTRAINT tbl_app_settings_week_start_day_check
  CHECK (week_start_day BETWEEN 0 AND 6);

COMMIT;

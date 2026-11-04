\set ON_ERROR_STOP on

BEGIN;

-- The kiosk home screen offers an instant ("30 menit") booking path and a
-- "Pilih waktu" scheduled booking path. The admin decides per tablet which of
-- them the tablet shows (toggles on the CMS Tablet Devices page).
ALTER TABLE tbl_kiosk_devices
  ADD COLUMN IF NOT EXISTS instant_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT true;

COMMIT;

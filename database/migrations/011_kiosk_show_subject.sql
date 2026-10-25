\set ON_ERROR_STOP on

BEGIN;

-- Meeting titles may be shown on the room tablet, but that decision belongs to
-- the admin per device (column behind the toggle in the CMS Tablet Devices page).
ALTER TABLE tbl_kiosk_devices
  ADD COLUMN show_subject boolean NOT NULL DEFAULT true;

COMMIT;

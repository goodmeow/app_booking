\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE tbl_kiosk_devices
  ADD COLUMN nfc_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN led_enabled boolean NOT NULL DEFAULT false;

COMMIT;

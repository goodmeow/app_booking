\set ON_ERROR_STOP on

BEGIN;

-- LED indicators are the default for room tablets (verified traffic-light
-- behaviour on the RK3288). NFC stays opt-in per device.
ALTER TABLE tbl_kiosk_devices
  ALTER COLUMN led_enabled SET DEFAULT true;

UPDATE tbl_kiosk_devices
SET led_enabled = true
WHERE revoked_at IS NULL;

COMMIT;

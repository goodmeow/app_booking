\set ON_ERROR_STOP on

-- Self signup is a product switch: production keeps it off and creates accounts
-- through the CMS, while a demo can turn it on to test the public form.
-- Default false matches the operational policy; the admin toggle in
-- Management > Settings changes this row.
BEGIN;

ALTER TABLE tbl_app_settings
  ADD COLUMN IF NOT EXISTS self_signup_enabled boolean NOT NULL DEFAULT false;

COMMIT;

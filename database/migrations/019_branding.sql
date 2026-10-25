\set ON_ERROR_STOP on

-- Brand assets live in the database so a container rebuild does not drop
-- uploaded logos. They are small (512 KB max) and served by the API.
BEGIN;

CREATE TABLE IF NOT EXISTS tbl_branding_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name text NOT NULL DEFAULT 'RoomBooking',
  document_title text NOT NULL DEFAULT 'RoomBooking — The Prasada',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO tbl_branding_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tbl_brand_assets (
  kind text PRIMARY KEY CHECK (kind IN ('mark', 'wordmark', 'favicon')),
  mime text NOT NULL,
  bytes bytea NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMIT;

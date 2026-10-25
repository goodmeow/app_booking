\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE tbl_kiosk_devices (
  _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  name character varying(80) NOT NULL,
  token_version integer NOT NULL DEFAULT 1,
  refresh_token_hash character(64) NOT NULL,
  previous_refresh_token_hash character(64),
  previous_refresh_valid_until timestamp with time zone,
  refresh_expires_at timestamp with time zone NOT NULL,
  last_seen_at timestamp with time zone,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tbl_kiosk_devices_room_fk
    FOREIGN KEY (room_id) REFERENCES tbl_users (_id),
  CONSTRAINT tbl_kiosk_devices_revoked_by_fk
    FOREIGN KEY (revoked_by) REFERENCES tbl_users (_id),
  CONSTRAINT tbl_kiosk_devices_token_version_positive
    CHECK (token_version > 0)
);

CREATE INDEX tbl_kiosk_devices_active_room_idx
  ON tbl_kiosk_devices (room_id)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX tbl_kiosk_devices_refresh_token_hash_idx
  ON tbl_kiosk_devices (refresh_token_hash);

COMMIT;

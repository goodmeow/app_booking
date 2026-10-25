\set ON_ERROR_STOP on

-- Backup is controlled from Global Settings. The scheduler runs inside the
-- app process (pg_dump is already in the Alpine runtime) and writes to the
-- configured path, normally /backups inside the mounted Docker volume.
BEGIN;

ALTER TABLE tbl_app_settings
  ADD COLUMN IF NOT EXISTS backup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_path text NOT NULL DEFAULT '/backups',
  ADD COLUMN IF NOT EXISTS backup_time text NOT NULL DEFAULT '02:30',
  ADD COLUMN IF NOT EXISTS backup_retention_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS backup_last_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS backup_last_status text;

ALTER TABLE tbl_app_settings
  DROP CONSTRAINT IF EXISTS tbl_app_settings_backup_time_check;
ALTER TABLE tbl_app_settings
  ADD CONSTRAINT tbl_app_settings_backup_time_check
  CHECK (backup_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE tbl_app_settings
  DROP CONSTRAINT IF EXISTS tbl_app_settings_backup_retention_check;
ALTER TABLE tbl_app_settings
  ADD CONSTRAINT tbl_app_settings_backup_retention_check
  CHECK (backup_retention_days BETWEEN 1 AND 365);

COMMIT;

\set ON_ERROR_STOP on

BEGIN;

-- Judul meeting boleh tampil di tablet ruangan, tetapi keputusan ini
-- milik admin per perangkat (kolom untuk toggle di CMS Perangkat Tablet).
ALTER TABLE tbl_kiosk_devices
  ADD COLUMN show_subject boolean NOT NULL DEFAULT true;

COMMIT;

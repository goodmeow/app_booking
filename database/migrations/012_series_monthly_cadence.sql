\set ON_ERROR_STOP on

-- Monthly cadence masuk ke booking type Recurring (One Time / Recurring
-- dengan pola harian/mingguan/bulanan). Constraint lama hanya menerima
-- daily/weekly sehingga pembuatan series monthly gagal 500 (23514).
BEGIN;

ALTER TABLE tbl_event_series
  DROP CONSTRAINT tbl_event_series_cadence_check,
  ADD CONSTRAINT tbl_event_series_cadence_check
    CHECK (cadence IN ('daily', 'weekly', 'monthly'));

COMMIT;

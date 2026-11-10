-- Shared rate-limit counters, so a fixed window keeps one budget no matter how
-- many API processes run. The server aligns window_start to a multiple of the
-- window length in JavaScript and passes it in; one row per bucket.
CREATE TABLE IF NOT EXISTS tbl_rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  window_start timestamp with time zone NOT NULL,
  hits integer NOT NULL DEFAULT 0
);

-- Cleanup deletes rows by age.
CREATE INDEX IF NOT EXISTS tbl_rate_limit_buckets_window_start_idx
  ON tbl_rate_limit_buckets (window_start);

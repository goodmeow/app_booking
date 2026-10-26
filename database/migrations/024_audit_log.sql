\set ON_ERROR_STOP on

-- Sensitive changes (role, floor, cards, settings) leave an audit row. The
-- actor name is copied so a deleted account still explains history.
BEGIN;

CREATE TABLE IF NOT EXISTS tbl_audit_log (
  _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES tbl_users (_id) ON DELETE SET NULL,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tbl_audit_log_created_idx
  ON tbl_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS tbl_audit_log_entity_idx
  ON tbl_audit_log (entity_type, entity_id, created_at DESC);

COMMIT;

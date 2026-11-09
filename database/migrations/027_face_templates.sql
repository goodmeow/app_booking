-- Face tables are owned by the separate face service (repository
-- app_faceunlock-service, migrations/001_face_tables.sql). This copy stays only
-- so a database rebuilt without that service still has the schema; runtime
-- writes and retention belong to the service.
--
-- Face-unlock templates: one row per employee account that may be verified by face.
--
-- The embedding is stored encrypted (AES-GCM) and is only readable by the face
-- service, which owns the key. The row is keyed by employee_id because that is
-- the identifier used elsewhere in booking data.
--
-- face_group groups accounts that belong to the same physical person (for
-- example one employee with an account on two floors). Two accounts in the same
-- group share a face, so identification cannot tell them apart; the caller
-- resolves the account from its own booking data.
CREATE TABLE IF NOT EXISTS tbl_face_templates (
  _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES tbl_users(_id) ON DELETE CASCADE,
  employee_id character varying NOT NULL,
  face_group character varying NOT NULL,
  embedding bytea NOT NULL,
  model_version character varying NOT NULL,
  quality real,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (employee_id, model_version)
);

CREATE INDEX IF NOT EXISTS tbl_face_templates_face_group_idx
  ON tbl_face_templates (face_group);

-- Audit of every face attempt, including rejected ones. Kept separate from
-- tbl_audit_log because it is high volume and has its own retention.
CREATE TABLE IF NOT EXISTS tbl_face_verify_log (
  _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id character varying,
  employee_id character varying,
  face_group character varying,
  result character varying NOT NULL,
  score real,
  margin real,
  liveness real,
  frame_count integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tbl_face_verify_log_created_idx
  ON tbl_face_verify_log (created_at DESC);

COMMENT ON COLUMN tbl_face_templates.embedding IS
  'AES-GCM ciphertext of the normalised 128-float embedding; key held by face service only';
COMMENT ON COLUMN tbl_face_verify_log.result IS
  'match | no_match | spoof | no_face | error';

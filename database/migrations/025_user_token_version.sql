-- Password changes must invalidate JWTs issued before the change. The token
-- carries this version; verifyPrincipalToken compares it with the account row.
ALTER TABLE tbl_users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 1;

ALTER TABLE tbl_users
  DROP CONSTRAINT IF EXISTS tbl_users_token_version_positive;

ALTER TABLE tbl_users
  ADD CONSTRAINT tbl_users_token_version_positive CHECK (token_version > 0);

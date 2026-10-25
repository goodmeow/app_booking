-- PostgreSQL 14 provides gen_random_uuid() in pg_catalog.
-- Keep prerequisite migration explicit for future extension requirements.
\set ON_ERROR_STOP on

BEGIN;
SELECT current_setting('server_version_num')::integer >= 140000
  AS supported_postgresql_version;
COMMIT;

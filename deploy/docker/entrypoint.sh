#!/bin/sh
# Container entrypoint: wait for PostgreSQL, apply pending migrations once,
# seed the three fixed roles, then hand over to the Node API.
set -eu

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/app/database/migrations}"
WAIT_ATTEMPTS="${DB_WAIT_ATTEMPTS:-60}"
WAIT_SECONDS="${DB_WAIT_SECONDS:-2}"

log() {
  printf '%s entrypoint: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

for variable in PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD; do
  value="$(printenv "$variable" 2>/dev/null || true)"
  if [ -z "$value" ]; then
    log "missing required environment variable $variable"
    exit 1
  fi
done

# All psql calls below inherit PGPASSWORD/PGHOST/... from the environment.
psql_run() {
  psql \
    --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --host "$PGHOST" \
    --port "$PGPORT" \
    --username "$PGUSER" \
    --dbname "$PGDATABASE" \
    "$@"
}

attempt=1
until pg_isready --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" --dbname "$PGDATABASE" >/dev/null 2>&1; do
  if [ "$attempt" -ge "$WAIT_ATTEMPTS" ]; then
    log "PostgreSQL at $PGHOST:$PGPORT did not become ready after $WAIT_ATTEMPTS attempts"
    exit 1
  fi
  log "waiting for PostgreSQL at $PGHOST:$PGPORT (attempt $attempt/$WAIT_ATTEMPTS)"
  attempt=$((attempt + 1))
  sleep "$WAIT_SECONDS"
done

log "PostgreSQL is ready"

psql_run >/dev/null <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamp with time zone NOT NULL DEFAULT now()
);
SQL

# All migrations run in one psql session under one advisory lock, so two
# containers starting against the same database cannot both apply the same
# file. The lock is held on this connection for the whole script.
migration_sql="$(mktemp)"
trap 'rm -f "$migration_sql"' EXIT

{
  printf "SELECT pg_advisory_lock(hashtext('schema_migrations'));\n"
  for migration_path in "$MIGRATIONS_DIR"/*.sql; do
    [ -f "$migration_path" ] || continue
    migration_name="$(basename "$migration_path")"
    printf "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE filename = '%s') AS applied \\gset\n" "$migration_name"
    printf '%s\n' '\if :applied'
    printf '%s\n' '\else'
    printf '%s\n' "\\i $migration_path"
    printf "INSERT INTO schema_migrations (filename) VALUES ('%s');\n" "$migration_name"
    printf '%s\n' '\endif'
  done
  printf "SELECT pg_advisory_unlock(hashtext('schema_migrations'));\n"
} > "$migration_sql"

psql_run --file "$migration_sql" >/dev/null

log "seeding fixed role ids"
psql_run >/dev/null <<'SQL'
INSERT INTO tbl_role (_id, role_name, is_deleted) VALUES
  ('471ba030-c950-41f9-90da-4e0fe10426a6', 'admin', false),
  ('67e9500b-908a-497d-9d3b-54bc020700cb', 'user', false),
  ('3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73', 'receptionist', false)
ON CONFLICT (_id) DO NOTHING;
SQL

log "starting API server"
exec node /app/build/server/server.bundle.cjs

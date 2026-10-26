#!/usr/bin/env bash
# Create the production role + database and apply all SQL migrations in order.
# Idempotent: the role/DB are created if missing; ALTER ROLE syncs the password with
# the env so /etc/360booking/app.env stays the source of truth. Migrations use the
# IF NOT EXISTS pattern, so they are safe to run again.
# Run as root: sudo ./deploy/02-provision-database.sh
set -euo pipefail

ENV_FILE="/etc/360booking/app.env"
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE does not exist. Copy it from deploy/app.env.example first." >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"

for var in PG_SUPERUSER_PASSWORD PGDATABASE PGUSER PGPASSWORD; do
  if [[ -z "${!var:-}" || "${!var}" == "change-me" ]]; then
    echo "Variable $var is not set in $ENV_FILE." >&2
    exit 1
  fi
done

if [[ "$PGDATABASE" == "360booking_reconstruction_test" ]]; then
  echo "The demo database name must not be used in production." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGPASSWORD="$PG_SUPERUSER_PASSWORD"

PSQL=(psql -v ON_ERROR_STOP=1 -h "$PGHOST" -U "$PG_SUPERUSER")

role_exists="$("${PSQL[@]}" -d postgres -Atc "SELECT 1 FROM pg_roles WHERE rolname = '$PGUSER'" || true)"
if [[ "$role_exists" != "1" ]]; then
  "${PSQL[@]}" -d postgres -c "CREATE ROLE \"$PGUSER\" LOGIN PASSWORD '$PGPASSWORD';"
else
  "${PSQL[@]}" -d postgres -c "ALTER ROLE \"$PGUSER\" LOGIN PASSWORD '$PGPASSWORD';"
fi

db_exists="$("${PSQL[@]}" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$PGDATABASE'" || true)"
if [[ "$db_exists" != "1" ]]; then
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$PGDATABASE\" OWNER \"$PGUSER\";"
else
  "${PSQL[@]}" -d postgres -c "ALTER DATABASE \"$PGDATABASE\" OWNER TO \"$PGUSER\";"
fi

echo "Menerapkan migrasi ke $PGDATABASE..."
for migration in "$REPO_ROOT"/database/migrations/*.sql; do
  echo "  $(basename "$migration")"
  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -U "$PG_SUPERUSER" -d "$PGDATABASE" -f "$migration" >/dev/null
done

# Migrations run as the superuser, so the objects belong to postgres. The API
# runs as the limited PGUSER; grant it runtime access and keep the grants for
# tables created by future migrations.
"${PSQL[@]}" -d "$PGDATABASE" -v app_role="$PGUSER" <<'SQL'
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO :"app_role";
SQL

echo "Database $PGDATABASE is ready for role $PGUSER."

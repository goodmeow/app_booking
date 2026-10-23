#!/usr/bin/env bash
# Buat role + database produksi dan terapkan seluruh migrasi SQL secara urut.
# Idempotent: role/DB dibuat bila belum ada; ALTER ROLE menyamakan sandi dengan
# env agar /etc/360booking/app.env tetap sumber kebenaran. Migrasi memakai pola
# IF NOT EXISTS sehingga aman dijalankan ulang.
# Jalankan sebagai root: sudo ./deploy/02-provision-database.sh
set -euo pipefail

ENV_FILE="/etc/360booking/app.env"
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE tidak ada. Salin dulu dari deploy/app.env.example." >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"

for var in PG_SUPERUSER_PASSWORD PGDATABASE PGUSER PGPASSWORD; do
  if [[ -z "${!var:-}" || "${!var}" == "change-me" ]]; then
    echo "Variabel $var belum diisi di $ENV_FILE." >&2
    exit 1
  fi
done

if [[ "$PGDATABASE" == "360booking_reconstruction_test" ]]; then
  echo "Nama database demo tidak boleh dipakai di produksi." >&2
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

echo "Database $PGDATABASE siap untuk role $PGUSER."

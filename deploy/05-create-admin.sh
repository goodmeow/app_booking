#!/usr/bin/env bash
# Buat/segarkan akun admin pertama. Jalankan setelah 02 (database siap) dan
# 04 (node_modules runtime terinstal di /opt/360booking, supaya bcrypt bisa
# di-resolve). Idempotent: upsert berdasarkan email unik.
# Jalankan sebagai root: sudo ./deploy/05-create-admin.sh
set -euo pipefail

ENV_FILE="/etc/360booking/app.env"
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE tidak ada." >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"

for var in ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD PGDATABASE PGUSER PGPASSWORD; do
  if [[ -z "${!var:-}" || "${!var}" == "change-me" ]]; then
    echo "Variabel $var belum diisi di $ENV_FILE." >&2
    exit 1
  fi
done

APP_ROOT="/opt/360booking"
export PGPASSWORD ADMIN_PASSWORD

cd "$APP_ROOT"
ADMIN_HASH="$(node -e "process.stdout.write(require('bcrypt').hashSync(process.env.ADMIN_PASSWORD, 12))")"
[[ -n "$ADMIN_HASH" ]] || { echo "bcrypt gagal membuat hash; apakah npm ci sudah selesai?" >&2; exit 1; }

psql -v ON_ERROR_STOP=1 -h "${PGHOST:-127.0.0.1}" -U "$PGUSER" -d "$PGDATABASE" \
  -v admin_name="$ADMIN_NAME" \
  -v admin_email="$ADMIN_EMAIL" \
  -v admin_hash="$ADMIN_HASH" \
  -v role_id="471ba030-c950-41f9-90da-4e0fe10426a6" <<'SQL'
INSERT INTO tbl_users (name, email, password, role_id, is_deleted, type)
VALUES (
  :'admin_name',
  :'admin_email',
  :'admin_hash',
  :'role_id',
  false,
  'employee'
)
ON CONFLICT (email) DO UPDATE
  SET name = EXCLUDED.name,
      password = EXCLUDED.password,
      role_id = EXCLUDED.role_id,
      is_deleted = false;

SELECT name, email FROM tbl_users WHERE email = :'admin_email';
SQL

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Two databases live in the same container:
#   demo   -> 360booking_reconstruction_test (accounts, NFC cards, tablet pairing)
#   parity -> 360booking_parity_test         (throwaway fixture for parity/regression)
readonly DEMO_DATABASE_NAME="360booking_reconstruction_test"
readonly PARITY_DATABASE_NAME="360booking_parity_test"

DATABASE_NAME="${BOOKING_PARITY_DB:-$PARITY_DATABASE_NAME}"
DATABASE_USER="${BOOKING_TEST_USER:-booking_test}"

if [[ "$DATABASE_NAME" != "$PARITY_DATABASE_NAME" ]]; then
  echo "Refusing to reset unexpected database: $DATABASE_NAME" >&2
  echo "This script only resets $PARITY_DATABASE_NAME." >&2
  exit 1
fi

# Defence in depth: the demo database holds the demo accounts, the NFC cards
# and the paired tablet, so a test reset must never drop it.
if [[ "$DATABASE_NAME" == "$DEMO_DATABASE_NAME" ]]; then
  echo "Refusing to reset the demo database: $DEMO_DATABASE_NAME" >&2
  exit 1
fi

# Docker 29 moved compose to a separate binary; try "docker compose"
# first, and fall back to "docker-compose" when it is not available.
run_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

run_compose up -d --wait postgres-test

parity_database_exists() {
  run_compose exec -T postgres-test psql \
    -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d postgres -Atc \
    "SELECT 1 FROM pg_database WHERE datname = '$DATABASE_NAME'" \
    | grep -qx 1
}

if parity_database_exists; then
  active_kiosk_devices="$(
    run_compose exec -T postgres-test psql \
      -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d "$DATABASE_NAME" -Atc \
      "SELECT count(*) FROM tbl_kiosk_devices WHERE revoked_at IS NULL" \
      2>/dev/null || echo 0
  )"
  if [[ "$active_kiosk_devices" =~ ^[0-9]+$ ]] && ((active_kiosk_devices > 0)); then
    echo "Warning: $DATABASE_NAME still has $active_kiosk_devices active kiosk device(s); they will be dropped." >&2
  fi

  run_compose exec -T postgres-test dropdb \
    --force -U "$DATABASE_USER" --if-exists "$DATABASE_NAME"
else
  echo "$DATABASE_NAME does not exist yet; creating it."
fi

run_compose exec -T postgres-test createdb \
  -U "$DATABASE_USER" -O "$DATABASE_USER" "$DATABASE_NAME"

for file in database/migrations/*.sql \
  database/seeds/development.sql \
  database/seeds/parity.sql; do
  echo "Applying $file"
  run_compose exec -T postgres-test psql \
    -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d "$DATABASE_NAME" < "$file"
done

echo "Parity database reset complete: $DATABASE_NAME (demo database $DEMO_DATABASE_NAME untouched)."

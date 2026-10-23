#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DATABASE_NAME="${BOOKING_TEST_DB:-360booking_reconstruction_test}"
DATABASE_USER="${BOOKING_TEST_USER:-booking_test}"

if [[ "$DATABASE_NAME" != "360booking_reconstruction_test" ]]; then
  echo "Refusing to reset unexpected database: $DATABASE_NAME" >&2
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
run_compose exec -T postgres-test dropdb \
  --force -U "$DATABASE_USER" --if-exists "$DATABASE_NAME"
run_compose exec -T postgres-test createdb \
  -U "$DATABASE_USER" -O "$DATABASE_USER" "$DATABASE_NAME"

for file in database/migrations/*.sql \
  database/seeds/development.sql \
  database/seeds/parity.sql; do
  echo "Applying $file"
  run_compose exec -T postgres-test psql \
    -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d "$DATABASE_NAME" < "$file"
done

echo "Parity database reset complete."

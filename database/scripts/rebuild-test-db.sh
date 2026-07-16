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

docker compose up -d postgres-test

readonly PG_READY_MAX_ATTEMPTS=30
for ((attempt = 1; attempt <= PG_READY_MAX_ATTEMPTS; attempt++)); do
  if docker compose exec -T postgres-test pg_isready \
    -U "$DATABASE_USER" -d postgres >/dev/null 2>&1; then
    break
  fi

  if ((attempt == PG_READY_MAX_ATTEMPTS)); then
    echo "PostgreSQL did not become ready after $PG_READY_MAX_ATTEMPTS attempts." >&2
    exit 1
  fi

  sleep 1
done

docker compose exec -T postgres-test dropdb \
  -U "$DATABASE_USER" --if-exists "$DATABASE_NAME"
docker compose exec -T postgres-test createdb \
  -U "$DATABASE_USER" -O "$DATABASE_USER" "$DATABASE_NAME"

for migration in database/migrations/*.sql; do
  echo "Applying $migration"
  docker compose exec -T postgres-test psql \
    -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d "$DATABASE_NAME" \
    < "$migration"
done

docker compose exec -T postgres-test psql \
  -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d "$DATABASE_NAME" \
  < database/seeds/development.sql

for test_file in database/tests/*.sql; do
  echo "Running $test_file"
  docker compose exec -T postgres-test psql \
    -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d "$DATABASE_NAME" \
    < "$test_file"
done

echo "Database reconstruction tests passed."

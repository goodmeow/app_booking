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

docker compose up -d --wait postgres-test
docker compose exec -T postgres-test dropdb \
  -U "$DATABASE_USER" --if-exists "$DATABASE_NAME"
docker compose exec -T postgres-test createdb \
  -U "$DATABASE_USER" -O "$DATABASE_USER" "$DATABASE_NAME"

for file in database/migrations/*.sql \
  database/seeds/development.sql \
  database/seeds/parity.sql; do
  echo "Applying $file"
  docker compose exec -T postgres-test psql \
    -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d "$DATABASE_NAME" < "$file"
done

echo "Parity database reset complete."

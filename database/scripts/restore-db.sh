#!/usr/bin/env bash
# Restore a 360 Scheduler custom-format dump into a disposable test database.
# Production restores are possible only with --force, and the script always
# refuses the legacy/parity database names.
#
#   ./database/scripts/restore-db.sh /var/backups/360booking/360booking-....dump
#   ./database/scripts/restore-db.sh dump --target-db=360booking_restore_test
set -euo pipefail
umask 077

readonly DEFAULT_ENV_FILE="/etc/360booking/backup.env"
readonly DEFAULT_TARGET_SUFFIX="_restore_test"
readonly FORBIDDEN_DATABASES=("bjb" "bjb_compare" "360booking_reconstruction_test" "360booking_parity_test")

ENV_FILE="$DEFAULT_ENV_FILE"
DUMP_FILE=""
TARGET_DB=""
FORCE=0

usage() {
  cat <<'USAGE'
Usage: restore-db.sh <dump-file> [options]

Options:
  --env-file=PATH    env file with PG* credentials (default /etc/360booking/backup.env)
  --target-db=NAME   destination database (default <PGDATABASE>_restore_test)
  --force            allow overwriting the production database name
  --help             show this text

Environment:
  PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD   connection (required: PGUSER)
  RESTORE_PROTECTED_DB   production database name (default 360booking)

The target database is dropped and recreated, so every connection to it is
terminated. The API is not restarted by this script.
USAGE
}

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

for argument in "$@"; do
  case "$argument" in
    --env-file=*) ENV_FILE="${argument#*=}" ;;
    --target-db=*) TARGET_DB="${argument#*=}" ;;
    --force) FORCE=1 ;;
    --help|-h) usage; exit 0 ;;
    --*)
      die "Unknown option: $argument (see --help)"
      ;;
    *)
      if [[ -n "$DUMP_FILE" ]]; then
        die "More than one dump file given"
      fi
      DUMP_FILE="$argument"
      ;;
  esac
done

[[ -n "$DUMP_FILE" ]] || die "No dump file given"
[[ -f "$DUMP_FILE" ]] || die "Dump file not found: $DUMP_FILE"
[[ -s "$DUMP_FILE" ]] || die "Dump file is empty: $DUMP_FILE"

if [[ -e "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
[[ -n "${PGUSER:-}" ]] || die "PGUSER is not set"

TARGET_DB="${TARGET_DB:-${PGDATABASE:-360booking}${DEFAULT_TARGET_SUFFIX}}"
PROTECTED_DB="${RESTORE_PROTECTED_DB:-360booking}"

for forbidden in "${FORBIDDEN_DATABASES[@]}"; do
  if [[ "$TARGET_DB" == "$forbidden" ]]; then
    die "Refusing to restore into legacy database \"$TARGET_DB\""
  fi
done

IS_PROTECTED=0
if [[ "$TARGET_DB" == "$PROTECTED_DB" || ( -n "${PGDATABASE:-}" && "$TARGET_DB" == "$PGDATABASE" ) ]]; then
  IS_PROTECTED=1
fi

if [[ "$IS_PROTECTED" == "1" && "$FORCE" != "1" ]]; then
  die "Target \"$TARGET_DB\" is a production database; pass --force after stopping the API and taking a backup"
fi

if [[ "$IS_PROTECTED" != "1" && "$FORCE" != "1" && ! "$TARGET_DB" =~ _test$|_check$|_scratch$ ]]; then
  die "Target \"$TARGET_DB\" does not look disposable; use a *_test name or pass --force"
fi

command -v pg_restore >/dev/null 2>&1 || die "pg_restore is not on PATH"
command -v psql >/dev/null 2>&1 || die "psql is not on PATH"

export PGHOST PGPORT PGUSER
export PGPASSWORD="${PGPASSWORD:-}"

if [[ -f "${DUMP_FILE}.sha256" ]]; then
  log "Verifying checksum"
  (
    cd "$(dirname "$DUMP_FILE")"
    sha256sum --check --status "$(basename "${DUMP_FILE}.sha256")"
  ) || die "Checksum verification failed"
fi

pg_restore --list "$DUMP_FILE" >/dev/null || die "Dump archive is not readable"

if [[ "$IS_PROTECTED" == "1" ]]; then
  log "WARNING: target is the production database \"$TARGET_DB\""
  log "WARNING: every connection to it will be terminated and its data replaced"
  log "WARNING: stop 360booking-server and keep the pre-restore backup before continuing"
fi

log "Recreating database \"$TARGET_DB\""
psql --dbname=postgres --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
  --set=ON_ERROR_STOP=1 \
  --command="DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);" \
  >/dev/null
psql --dbname=postgres --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
  --set=ON_ERROR_STOP=1 \
  --command="CREATE DATABASE \"$TARGET_DB\" OWNER \"$PGUSER\";" \
  >/dev/null

log "Restoring $DUMP_FILE into $TARGET_DB"
pg_restore \
  --dbname="$TARGET_DB" \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --single-transaction \
  --exit-on-error \
  "$DUMP_FILE"

log "Restore finished; row counts:"
psql --dbname="$TARGET_DB" --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
  --tuples-only --no-align \
  --command="SELECT 'tbl_users=' || (SELECT count(*) FROM tbl_users)
                 || ' tbl_rooms=' || (SELECT count(*) FROM tbl_rooms)
                 || ' tbl_user_cards=' || (SELECT count(*) FROM tbl_user_cards);"

log "Point the API at \"$TARGET_DB\" temporarily to test login and calendar, then drop it when done."
log "Never leave PGDATABASE pointing at the restore test database."

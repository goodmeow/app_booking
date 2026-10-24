#!/usr/bin/env bash
# Dump the 360 Scheduler database in PostgreSQL custom format, verify the
# archive, keep a checksum, prune old files, and optionally copy everything
# off-host with rsync.
#
# Credentials come from the environment or from an env file (default
# /etc/360booking/backup.env, mode 0600). Nothing secret is printed.
#
#   sudo install -d -m 0700 -o postgres -g postgres /var/backups/360booking
#   sudo ./database/scripts/backup-db.sh --env-file=/etc/360booking/backup.env
set -euo pipefail
umask 077

readonly DEFAULT_ENV_FILE="/etc/360booking/backup.env"
readonly DEFAULT_BACKUP_DIR="/var/backups/360booking"
readonly DEFAULT_RETENTION_DAYS="14"
readonly FORBIDDEN_DATABASES=("bjb" "bjb_compare" "360booking_reconstruction_test" "360booking_parity_test")

ENV_FILE="$DEFAULT_ENV_FILE"
OUTPUT_DIR=""
RETENTION_DAYS=""
ALLOW_OTHER_DB=0

usage() {
  cat <<'USAGE'
Usage: backup-db.sh [options]

Options:
  --env-file=PATH      env file with PG* credentials (default /etc/360booking/backup.env)
  --output-dir=PATH    backup directory (default /var/backups/360booking, env BACKUP_DIR)
  --retention-days=N   delete dumps older than N days (default 14, env BACKUP_RETENTION_DAYS)
  --allow-other-db     allow a PGDATABASE different from BACKUP_ALLOWED_DB
  --help               show this text

Environment:
  PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD   connection (required: PGDATABASE, PGUSER)
  BACKUP_ALLOWED_DB     expected database name (default 360booking)
  BACKUP_DIR            output directory
  BACKUP_RETENTION_DAYS retention in days
  BACKUP_RSYNC_TARGET   optional rsync destination, e.g. backup@nas:/srv/360booking/
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
    --output-dir=*) OUTPUT_DIR="${argument#*=}" ;;
    --retention-days=*) RETENTION_DAYS="${argument#*=}" ;;
    --allow-other-db) ALLOW_OTHER_DB=1 ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown argument: $argument (see --help)" ;;
  esac
done

if [[ -e "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  if [[ "$ENV_FILE" != "$DEFAULT_ENV_FILE" ]]; then
    die "Env file not found: $ENV_FILE"
  fi
  log "No $ENV_FILE; using the current environment"
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"

[[ -n "${PGDATABASE:-}" ]] || die "PGDATABASE is not set"
[[ -n "${PGUSER:-}" ]] || die "PGUSER is not set"

for forbidden in "${FORBIDDEN_DATABASES[@]}"; do
  if [[ "$PGDATABASE" == "$forbidden" ]]; then
    die "Refusing to back up legacy database \"$PGDATABASE\""
  fi
done

ALLOWED_DB="${BACKUP_ALLOWED_DB:-360booking}"
if [[ "$PGDATABASE" != "$ALLOWED_DB" && "$ALLOW_OTHER_DB" != "1" ]]; then
  die "PGDATABASE=\"$PGDATABASE\" is not BACKUP_ALLOWED_DB=\"$ALLOWED_DB\" (pass --allow-other-db if intentional)"
fi

BACKUP_DIR="${OUTPUT_DIR:-${BACKUP_DIR:-$DEFAULT_BACKUP_DIR}}"
RETENTION_DAYS="${RETENTION_DAYS:-${BACKUP_RETENTION_DAYS:-$DEFAULT_RETENTION_DAYS}}"

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "Retention must be a whole number of days"
(( RETENTION_DAYS >= 1 )) || die "Retention must be at least 1 day"

command -v pg_dump >/dev/null 2>&1 || die "pg_dump is not on PATH"
command -v pg_restore >/dev/null 2>&1 || die "pg_restore is not on PATH"

if [[ ! -d "$BACKUP_DIR" ]]; then
  mkdir -p "$BACKUP_DIR" || die "Cannot create $BACKUP_DIR (run as a user that may write there)"
fi
[[ -w "$BACKUP_DIR" ]] || die "$BACKUP_DIR is not writable by $(id -un)"

export PGHOST PGPORT PGDATABASE PGUSER
export PGPASSWORD="${PGPASSWORD:-}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base_name="${PGDATABASE}-${timestamp}.dump"
target_file="${BACKUP_DIR}/${base_name}"
partial_file="${target_file}.part"

cleanup_partial() {
  rm -f "$partial_file"
}
trap cleanup_partial EXIT

log "Dumping ${PGDATABASE} from ${PGHOST}:${PGPORT} to ${partial_file}"
if ! pg_dump \
  --format=custom \
  --file="$partial_file" \
  --dbname="$PGDATABASE" \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER"; then
  die "pg_dump failed"
fi

[[ -s "$partial_file" ]] || die "pg_dump produced an empty file"

# A custom-format archive may start with PGDMP; pg_restore --list is the real
# readability check, so a truncated dump never replaces a good one.
pg_restore --list "$partial_file" >/dev/null || die "Dump archive is not readable"
mv "$partial_file" "$target_file"
trap - EXIT

file_size="$(stat -c %s "$target_file")"
(
  cd "$BACKUP_DIR"
  sha256sum "$base_name" > "${base_name}.sha256"
  sha256sum --check --status "${base_name}.sha256"
) || die "Checksum verification failed for $target_file"

log "Backup OK: $target_file (${file_size} bytes)"
log "Checksum: ${target_file}.sha256"

pruned=0
while IFS= read -r old_file; do
  [[ -n "$old_file" ]] || continue
  rm -f "$old_file"
  pruned=$((pruned + 1))
done < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name "${PGDATABASE}-*.dump" -o -name "${PGDATABASE}-*.dump.sha256" \) \
    -mtime "+${RETENTION_DAYS}" -print
)
if (( pruned > 0 )); then
  log "Pruned $pruned file(s) older than ${RETENTION_DAYS} days"
fi

if [[ -n "${BACKUP_RSYNC_TARGET:-}" ]]; then
  command -v rsync >/dev/null 2>&1 || die "BACKUP_RSYNC_TARGET is set but rsync is missing"
  log "Copying to ${BACKUP_RSYNC_TARGET}"
  rsync --archive --partial "$target_file" "${target_file}.sha256" "$BACKUP_RSYNC_TARGET" \
    || die "rsync to BACKUP_RSYNC_TARGET failed (local backup is intact)"
  log "Off-host copy OK"
fi

log "Done"

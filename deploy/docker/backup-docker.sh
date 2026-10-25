#!/usr/bin/env bash
# Daily logical backup for the Docker Alpine stack. The dump runs inside the
# postgres container; this host only stores/verifies the archive.
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
umask 077

REPO_DIR="${ROOMBOOKING_REPO:-/mnt/e/rea-vault/app_booking}"
COMPOSE_FILE="$REPO_DIR/deploy/docker/compose.alpine.yaml"
PROJECT="${ROOMBOOKING_PROJECT:-roombooking-alpine}"
DB_NAME="${ROOMBOOKING_DB:-360booking}"
DB_USER="${ROOMBOOKING_DB_USER:-booking}"
BACKUP_DIR="${ROOMBOOKING_BACKUP_DIR:-/home/goodmeow/backups/360booking}"
RETENTION_DAYS="${ROOMBOOKING_BACKUP_RETENTION_DAYS:-14}"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v docker-compose >/dev/null 2>&1 || die "docker-compose is not installed"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="${DB_NAME}-${timestamp}.dump"
target="$BACKUP_DIR/$base"
partial="$target.part"
trap 'rm -f "$partial"' EXIT

compose() {
  docker-compose -f "$COMPOSE_FILE" -p "$PROJECT" "$@"
}

log "Dumping $DB_NAME from Docker project $PROJECT"
compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$partial"
[[ -s "$partial" ]] || die "pg_dump produced an empty archive"

log "Verifying archive"
compose exec -T db pg_restore --list < "$partial" >/dev/null || die "pg_restore cannot read the archive"
mv "$partial" "$target"
trap - EXIT

(
  cd "$BACKUP_DIR"
  sha256sum "$base" > "$base.sha256"
  sha256sum --check --status "$base.sha256"
) || die "checksum verification failed"

log "Backup OK: $target ($(stat -c %s "$target") bytes)"
log "Pruning archives older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name "${DB_NAME}-*.dump" -o -name "${DB_NAME}-*.dump.sha256" \) \
  -mtime "+$RETENTION_DAYS" -print -delete

if [[ -n "${ROOMBOOKING_BACKUP_RSYNC_TARGET:-}" ]]; then
  command -v rsync >/dev/null 2>&1 || die "rsync target set but rsync is missing"
  rsync --archive --partial "$target" "$target.sha256" "$ROOMBOOKING_BACKUP_RSYNC_TARGET"
  log "Off-host copy OK"
fi

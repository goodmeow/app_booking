#!/usr/bin/env bash
# One-command native installer for RoomBooking on a fresh Ubuntu host.
#
#   sudo ./deploy/bootstrap.sh
#
# Defaults: public HTTP on port 80, setup page at http://<detected-ip>/setup.
# The first admin is created from that setup page, not from this script.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="/etc/360booking/app.env"
PUBLIC_IP=""
PUBLIC_PORT="80"
BUILD_USER="${SUDO_USER:-root}"
FORCE=0

usage() {
  cat <<'USAGE'
Usage: sudo ./deploy/bootstrap.sh [--ip ADDRESS] [--port PORT] [--build-user USER] [--force]

  --ip          Public IP written to CORS_ORIGINS (default: first hostname -I address)
  --port        Public HTTP port (default: 80)
  --build-user  Non-root user that runs npm build (default: SUDO_USER, else root)
  --force       Replace /etc/360booking/app.env if it already exists
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip) PUBLIC_IP="${2:?missing value}"; shift 2 ;;
    --port) PUBLIC_PORT="${2:?missing value}"; shift 2 ;;
    --build-user) BUILD_USER="${2:?missing value}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo ./deploy/bootstrap.sh" >&2
  exit 1
fi

[[ "$PUBLIC_PORT" =~ ^[0-9]+$ ]] && (( PUBLIC_PORT >= 1 && PUBLIC_PORT <= 65535 )) || {
  echo "Invalid port: $PUBLIC_PORT" >&2; exit 1
}
if [[ -z "$PUBLIC_IP" ]]; then
  # Prefer the address that owns the default route; hostname -I can put a
  # Docker bridge first on a multi-NIC host.
  PUBLIC_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}' || true)"
  if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP="$(hostname -I | awk '{print $1}')"
  fi
fi
[[ -n "$PUBLIC_IP" ]] || { echo "Cannot detect a public IP; pass --ip." >&2; exit 1; }
PUBLIC_ORIGIN="http://${PUBLIC_IP}${PUBLIC_PORT:+:$PUBLIC_PORT}"
if [[ "$PUBLIC_PORT" == "80" ]]; then
  PUBLIC_ORIGIN="http://${PUBLIC_IP}"
fi

if [[ -e "$ENV_FILE" && "$FORCE" != "1" ]]; then
  echo "$ENV_FILE already exists; refusing to overwrite (use --force intentionally)." >&2
  exit 1
fi

log() { printf '\n== %s ==\n' "$*"; }
psql_super() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres "$@"; }

log "1/7 Install prerequisites"
"$REPO_ROOT/deploy/01-install-prerequisites.sh"

log "2/7 Generate production environment"
DB_PASSWORD="$(openssl rand -hex 24)"
SUPER_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
install -d -m 0750 /etc/360booking
cat > "$ENV_FILE" <<EOF
NODE_ENV=production
BASE=/

HOST=127.0.0.1
PORT=8081
SERVER_PORT=9091
SSR=false
HTTPS=false
TRUST_PROXY=true

PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=360booking
PGUSER=360booking
PGPASSWORD=${DB_PASSWORD}
PG_SUPERUSER=postgres
PG_SUPERUSER_PASSWORD=${SUPER_PASSWORD}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY_TOKEN=1d
JWT_ISSUER=360-scheduler
JWT_AUDIENCE=360-scheduler-web
KIOSK_JWT_AUDIENCE=360-scheduler-kiosk
KIOSK_JWT_EXPIRY=15m
KIOSK_REFRESH_DAYS=30

CORS_ORIGINS=${PUBLIC_ORIGIN}

APP_TIMEZONE=Asia/Jakarta
MAX_BOOKING_DURATION_HOURS=24
MAX_CALENDAR_RANGE_DAYS=120
MAX_PREVIEW_CONFLICTS=50
RECURRENCE_MAX_DAYS=366
RECURRENCE_MAX_OCCURRENCES=200
FLOOR_RESTRICTION=true
EOF
chown root:360booking "$ENV_FILE"
chmod 640 "$ENV_FILE"

log "3/7 Set postgres superuser password for provisioning"
psql_super -c "ALTER ROLE postgres PASSWORD '${SUPER_PASSWORD}';"

log "4/7 Provision database and migrations"
"$REPO_ROOT/deploy/02-provision-database.sh"

log "5/7 Seed fixed role IDs"
PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U 360booking -d 360booking <<'SQL'
INSERT INTO tbl_role (_id, role_name, is_deleted) VALUES
  ('471ba030-c950-41f9-90da-4e0fe10426a6', 'admin', false),
  ('67e9500b-908a-497d-9d3b-54bc020700cb', 'user', false),
  ('3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73', 'receptionist', false)
ON CONFLICT (_id) DO NOTHING;
SQL

log "6/7 Build production artifacts as ${BUILD_USER}"
if [[ "$BUILD_USER" == "root" ]]; then
  "$REPO_ROOT/deploy/03-build.sh"
else
  sudo -u "$BUILD_USER" bash -lc "cd '$REPO_ROOT' && ./deploy/03-build.sh"
fi

log "7/7 Install app, systemd, nginx"
"$REPO_ROOT/deploy/04-install-app.sh"

if [[ "$PUBLIC_PORT" != "80" ]]; then
  sed -i "s/listen 80;/listen ${PUBLIC_PORT};/; s/listen \[::\]:80;/listen [::]:${PUBLIC_PORT};/" /etc/nginx/sites-available/360booking.conf
  nginx -t
  systemctl reload nginx
  ufw allow "${PUBLIC_PORT}/tcp"
fi

log "Selesai"
cat <<EOF

RoomBooking siap.

  Setup admin : ${PUBLIC_ORIGIN}/setup
  CMS         : ${PUBLIC_ORIGIN}/
  API health  : ${PUBLIC_ORIGIN}/api/health
  Service     : systemctl status 360booking-server
  Env         : ${ENV_FILE}

Buka /setup untuk membuat admin pertama. Setelah itu login dan import user/ruangan.
EOF

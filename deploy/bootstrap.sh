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
NO_NGINX=0
BIND_HOST=""
ORIGIN_OVERRIDE=""
PROXY_IP=""

usage() {
  cat <<'USAGE'
Usage: sudo ./deploy/bootstrap.sh [--ip ADDRESS] [--port PORT] [--build-user USER]
       [--no-nginx] [--bind-host ADDRESS] [--origin URL] [--proxy-ip ADDRESS] [--force]

  --ip          LAN IP written to CORS_ORIGINS (default: single non-container
                IPv4 interface; required on a multi-NIC host)
  --port        Public HTTP port for local nginx (default: 80)
  --build-user  Non-root user that runs npm build (default: SUDO_USER)
  --no-nginx    Do not install/configure nginx on this host; use an external one
  --bind-host   API listen address (default: 127.0.0.1, or 0.0.0.0 with --no-nginx)
  --origin URL  Exact external origin for CORS (e.g. http://roombooking.lan)
  --proxy-ip    Allow API port 9091 only from this external-nginx IP
  --force       Replace /etc/360booking/app.env if it already exists

Contoh external nginx:
  sudo ./deploy/bootstrap.sh --no-nginx --proxy-ip 192.168.18.2 \
    --origin http://roombooking.lan
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip) PUBLIC_IP="${2:?missing value}"; shift 2 ;;
    --port) PUBLIC_PORT="${2:?missing value}"; shift 2 ;;
    --build-user) BUILD_USER="${2:?missing value}"; shift 2 ;;
    --no-nginx) NO_NGINX=1; shift ;;
    --bind-host) BIND_HOST="${2:?missing value}"; shift 2 ;;
    --origin) ORIGIN_OVERRIDE="${2:?missing value}"; shift 2 ;;
    --proxy-ip) PROXY_IP="${2:?missing value}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo ./deploy/bootstrap.sh" >&2
  exit 1
fi
if [[ "$BUILD_USER" == "root" ]]; then
  echo "Refusing to build as root; run with sudo as a normal user or pass --build-user USER." >&2
  exit 1
fi
id -u "$BUILD_USER" >/dev/null 2>&1 || { echo "Build user does not exist: $BUILD_USER" >&2; exit 1; }

[[ "$PUBLIC_PORT" =~ ^[0-9]+$ ]] && (( PUBLIC_PORT >= 1 && PUBLIC_PORT <= 65535 )) || {
  echo "Invalid port: $PUBLIC_PORT" >&2; exit 1
}

if [[ "$NO_NGINX" == "1" ]]; then
  BIND_HOST="${BIND_HOST:-0.0.0.0}"
  if [[ "$PUBLIC_PORT" != "80" ]]; then
    echo "WARNING: --port is ignored in --no-nginx mode; the external nginx owns the public port." >&2
  fi
  if [[ "$BIND_HOST" == "127.0.0.1" ]]; then
    echo "WARNING: API listens on 127.0.0.1; an external nginx cannot reach it." >&2
  fi
else
  [[ -z "$BIND_HOST" ]] || { echo "--bind-host requires --no-nginx." >&2; exit 1; }
  BIND_HOST="127.0.0.1"
fi
if [[ -n "$PROXY_IP" && "$NO_NGINX" != "1" ]]; then
  echo "--proxy-ip requires --no-nginx." >&2; exit 1
fi

if [[ -n "$ORIGIN_OVERRIDE" ]]; then
  ORIGIN_OVERRIDE="${ORIGIN_OVERRIDE%/}"
  [[ "$ORIGIN_OVERRIDE" =~ ^https?://[^/]+$ ]] || {
    echo "Invalid --origin: $ORIGIN_OVERRIDE (use scheme://host[:port], no path)." >&2; exit 1
  }
  PUBLIC_ORIGIN="$ORIGIN_OVERRIDE"
else
  if [[ -z "$PUBLIC_IP" ]]; then
    # Pick one real LAN IPv4. Docker bridges and default-route WAN addresses are
    # common on multi-NIC hosts, so more than one candidate requires --ip.
    mapfile -t LAN_IPS < <(
      ip -4 -o addr show scope global 2>/dev/null \
        | awk '$2 !~ /^(lo|docker|br-|veth|virbr|tun|tap|tailscale|zt)/ { split($4, a, "/"); print a[1] }' \
        | sort -u
    )
    if [[ ${#LAN_IPS[@]} -eq 1 ]]; then
      PUBLIC_IP="${LAN_IPS[0]}"
    elif [[ ${#LAN_IPS[@]} -gt 1 ]]; then
      echo "Multiple LAN IPv4 addresses: ${LAN_IPS[*]}" >&2
      echo "Choose the CMS/tablet address with --ip ADDRESS." >&2
      exit 1
    else
      PUBLIC_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}' || true)"
      [[ -n "$PUBLIC_IP" ]] || PUBLIC_IP="$(hostname -I | awk '{print $1}')"
    fi
  fi
  [[ -n "$PUBLIC_IP" ]] || { echo "Cannot detect a LAN IP; pass --ip or --origin." >&2; exit 1; }

  # IPv6 needs brackets in an origin; a bare 2001:db8::1 is not a valid URL.
  if [[ "$PUBLIC_IP" == *:* ]]; then
    [[ "$PUBLIC_IP" =~ ^[0-9A-Fa-f:]+$ ]] || { echo "Invalid IPv6 address: $PUBLIC_IP" >&2; exit 1; }
    PUBLIC_HOST="[${PUBLIC_IP}]"
  else
    [[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo "Invalid IPv4 address: $PUBLIC_IP" >&2; exit 1; }
    IFS=. read -r o1 o2 o3 o4 <<< "$PUBLIC_IP"
    for octet in "$o1" "$o2" "$o3" "$o4"; do
      (( octet >= 0 && octet <= 255 )) || { echo "Invalid IPv4 address: $PUBLIC_IP" >&2; exit 1; }
    done
    PUBLIC_HOST="$PUBLIC_IP"
  fi
  PUBLIC_ORIGIN="http://${PUBLIC_HOST}${PUBLIC_PORT:+:$PUBLIC_PORT}"
  if [[ "$PUBLIC_PORT" == "80" ]]; then
    PUBLIC_ORIGIN="http://${PUBLIC_HOST}"
  fi
fi

if [[ "$NO_NGINX" == "1" && -z "$ORIGIN_OVERRIDE" ]]; then
  echo "WARNING: CORS origin is ${PUBLIC_ORIGIN}; pass --origin if the external nginx uses another host." >&2
fi

if [[ -e "$ENV_FILE" && "$FORCE" != "1" ]]; then
  echo "$ENV_FILE already exists; refusing to overwrite (use --force intentionally)." >&2
  exit 1
fi

log() { printf '\n== %s ==\n' "$*"; }
psql_super() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres "$@"; }

log "1/7 Install prerequisites"
if [[ "$NO_NGINX" == "1" ]]; then
  SKIP_NGINX=1 "$REPO_ROOT/deploy/01-install-prerequisites.sh"
else
  "$REPO_ROOT/deploy/01-install-prerequisites.sh"
fi

log "2/7 Generate production environment"
DB_PASSWORD="$(openssl rand -hex 24)"
SUPER_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
install -d -m 0750 /etc/360booking
cat > "$ENV_FILE" <<EOF
NODE_ENV=production
BASE=/

HOST=${BIND_HOST}
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
if [[ "$NO_NGINX" == "1" ]]; then
  SKIP_NGINX=1 "$REPO_ROOT/deploy/04-install-app.sh"
  if [[ -n "$PROXY_IP" ]]; then
    ufw allow from "$PROXY_IP" to any port 9091 proto tcp
  else
    echo "WARNING: allow API port 9091 from the nginx host, e.g.:" >&2
    echo "  ufw allow from <NGINX_IP> to any port 9091 proto tcp" >&2
  fi
else
  "$REPO_ROOT/deploy/04-install-app.sh"

  if [[ "$PUBLIC_PORT" != "80" ]]; then
    sed -i "s/listen 80;/listen ${PUBLIC_PORT};/; s/listen \[::\]:80;/listen [::]:${PUBLIC_PORT};/" /etc/nginx/sites-available/360booking.conf
    nginx -t
    systemctl reload nginx
    ufw allow "${PUBLIC_PORT}/tcp"
  fi
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

if [[ "$NO_NGINX" == "1" ]]; then
  cat <<EOF

External nginx:
  - copy $REPO_ROOT/build/client/ ke root nginx
  - proxy /api/ dan /socket.io/ ke <APP_SERVER>:9091
  - origin CORS: ${PUBLIC_ORIGIN}
EOF
fi

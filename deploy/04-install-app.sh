#!/usr/bin/env bash
# Pasang artefak build ke /opt/360booking, pasang systemd dan nginx, lalu
# mulai layanan. Asumsinya: build/ + package.json + package-lock.json ada di
# repo root host ini (hasil 03-build.sh), dan 02-provision-database.sh sudah
# dijalankan. Jalankan sebagai root: sudo ./deploy/04-install-app.sh
set -euo pipefail

ENV_FILE="/etc/360booking/app.env"
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE tidak ada." >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="/opt/360booking"

[[ -d "$REPO_ROOT/build/client" ]] || { echo "build/client belum ada; jalankan 03-build.sh." >&2; exit 1; }
[[ -f "$REPO_ROOT/build/server/server.bundle.cjs" ]] || { echo "build/server belum ada; jalankan 03-build.sh." >&2; exit 1; }

mkdir -p "$APP_ROOT"

# Client statis dipakai nginx langsung; server bundle dimulai dari
# /opt/360booking/server dan mencari node_modules di induknya.
rsync -a --delete "$REPO_ROOT/build/client/" "$APP_ROOT/client/"
rsync -a --delete "$REPO_ROOT/build/server/" "$APP_ROOT/server/"
cp "$REPO_ROOT/package.json" "$REPO_ROOT/package-lock.json" "$APP_ROOT/"

chown -R 360booking:360booking "$APP_ROOT"

# Runtime-only dependencies (bundle Webpack mengecualikan node_modules).
npm ci --omit=dev --prefix "$APP_ROOT" 2>/dev/null
chown -R 360booking:360booking "$APP_ROOT/node_modules"

install -m 0644 "$REPO_ROOT/deploy/systemd/360booking-server.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now 360booking-server.service

install -m 0644 "$REPO_ROOT/deploy/nginx/360booking.conf" /etc/nginx/sites-available/360booking.conf
ln -sf /etc/nginx/sites-available/360booking.conf /etc/nginx/sites-enabled/360booking.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

systemctl status 360booking-server.service --no-pager | head -6
sync
# Endpoint health khusus probe: /api/health tanpa token.
http_code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${SERVER_PORT:-9091}/api/health || true)"
if [[ "$http_code" != "000" ]]; then
  echo "API hidup (respons $http_code)."
else
  echo "API belum merespons; periksa: journalctl -u 360booking-server -n 30"
  exit 1
fi

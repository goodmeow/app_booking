#!/usr/bin/env bash
# Instal dependensi dasar untuk deploy 360 Scheduler di Ubuntu Server 22.04.
# Jalankan sebagai root: sudo ./deploy/01-install-prerequisites.sh
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Jalankan sebagai root (sudo)." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg

# Node 20 LTS cukup untuk Vite 8 dan runtime server; NodeSource official.
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version

# PostgreSQL 14 + nginx dari repo distro.
apt-get install -y postgresql-14 postgresql-14-postgis-3 nginx acl
systemctl enable --now postgresql nginx

# UFW: izin inbound hanya yang perlu. Kios/CMS cukup 22 + 80/443.
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
yes | ufw enable
ufw status

# User sistem non-login untuk menjalankan server bundle.
id -u "360booking" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin 360booking

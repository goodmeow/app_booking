#!/usr/bin/env bash
# Install the base dependencies to deploy 360 Scheduler on Ubuntu Server 22.04.
# Run as root: sudo ./deploy/01-install-prerequisites.sh
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

SKIP_NGINX="${SKIP_NGINX:-0}"

apt-get update
apt-get install -y ca-certificates curl gnupg

# Node 20 LTS is enough for Vite 8 and the server runtime; official NodeSource.
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version

# PostgreSQL 14 + nginx from the distro repository. External-nginx mode still
# installs PostgreSQL but leaves the host's web server alone.
if [[ "$SKIP_NGINX" == "1" ]]; then
  apt-get install -y postgresql-14 postgresql-14-postgis-3 acl
  systemctl enable --now postgresql
else
  apt-get install -y postgresql-14 postgresql-14-postgis-3 nginx acl
  systemctl enable --now postgresql nginx
fi

# UFW: allow only the inbound ports that are needed. The kiosk/CMS only need 22 + 80/443.
apt-get install -y ufw
ufw allow OpenSSH
if [[ "$SKIP_NGINX" != "1" ]]; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi
yes | ufw enable
ufw status

# Non-login system user that runs the server bundle.
id -u "360booking" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin 360booking

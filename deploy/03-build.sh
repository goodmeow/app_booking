#!/usr/bin/env bash
# Build artefak produksi: client statis + server bundle.
# Boleh dijalankan di mesin deploy atau mesin lokal; hasilnya dipasang oleh
# 04-install-app.sh di host Ubuntu.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

npm ci
npm run build

echo "Isi build/:"
du -sh build/client build/server

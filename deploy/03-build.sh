#!/usr/bin/env bash
# Build the production artifacts: static client + server bundle.
# May run on the deploy machine or a local machine; the result is installed by
# 04-install-app.sh on the Ubuntu host.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

npm ci
npm run build

echo "Isi build/:"
du -sh build/client build/server

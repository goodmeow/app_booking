#!/usr/bin/env bash
# Lightweight health probe for the Docker stack. Logs a line and keeps a small
# status file; a non-zero exit is visible to cron/monitoring.
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

BASE_URL="${ROOMBOOKING_HEALTH_URL:-http://127.0.0.1:8082}"
STATUS_FILE="${ROOMBOOKING_HEALTH_STATUS:-/home/goodmeow/logs/360booking-health.status}"
LOG_FILE="${ROOMBOOKING_HEALTH_LOG:-/home/goodmeow/logs/360booking-health.log}"
mkdir -p "$(dirname "$STATUS_FILE")" "$(dirname "$LOG_FILE")"

check() {
  local name="$1" url="$2" expected="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" || true)"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL $name HTTP $code (expected $expected)"
    return 1
  fi
  echo "OK $name HTTP $code"
}

api_result="$(check api "$BASE_URL/api/health" 200 || true)"
cms_result="$(check cms "$BASE_URL/" 200 || true)"
result="$api_result"$'\n'"$cms_result"
status="ok"
if ! grep -q '^OK api' <<<"$result" || ! grep -q '^OK cms' <<<"$result"; then
  status="fail"
fi
line="$(date -u +%Y-%m-%dT%H:%M:%SZ) $status $result"
printf '%s\n' "$line" >> "$LOG_FILE"
printf '%s\n' "$line" > "$STATUS_FILE"
# Keep the probe log bounded.
tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
[[ "$status" == "ok" ]]

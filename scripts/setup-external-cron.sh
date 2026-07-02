#!/usr/bin/env bash
# Register BANTAYOG cron jobs on cron-job.org → Railway API (free alternative to Vercel Hobby crons).
#
# Prerequisites:
#   1. cron-job.org account + API key (Console → Settings)
#   2. Railway server deployed with CRON_SECRET set
#
# Usage:
#   CRONJOB_ORG_API_KEY=... \
#   RAILWAY_API_URL=https://your-app.up.railway.app \
#   CRON_SECRET=... \
#   ./scripts/setup-external-cron.sh
#
# Optional: test endpoints only (no cron-job.org API calls)
#   ./scripts/setup-external-cron.sh --test-only

set -euo pipefail

API_BASE="https://api.cron-job.org/jobs"
TEST_ONLY=false

if [[ "${1:-}" == "--test-only" ]]; then
  TEST_ONLY=true
fi

: "${RAILWAY_API_URL:?Set RAILWAY_API_URL (e.g. https://your-app.up.railway.app)}"
: "${CRON_SECRET:?Set CRON_SECRET (same value as on Railway)}"

RAILWAY_API_URL="${RAILWAY_API_URL%/}"

test_endpoint() {
  local name="$1"
  local path="$2"
  local url="${RAILWAY_API_URL}${path}"
  echo "→ Testing ${name}: POST ${url}"

  local status
  status="$(curl -sS -o /tmp/bantayog-cron-test.json -w "%{http_code}" \
    -X POST "${url}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json")"

  echo "  HTTP ${status}"
  cat /tmp/bantayog-cron-test.json
  echo ""

  if [[ "${status}" != "200" && "${status}" != "201" ]]; then
    echo "ERROR: ${name} returned HTTP ${status}. Fix Railway deploy / CRON_SECRET before registering crons." >&2
    exit 1
  fi
}

test_endpoint "reconcile" "/api/cron/reconcile"
test_endpoint "tier-reeval" "/api/cron/tier-reeval"

if [[ "${TEST_ONLY}" == "true" ]]; then
  echo "✓ Both Railway cron endpoints responded successfully."
  exit 0
fi

: "${CRONJOB_ORG_API_KEY:?Set CRONJOB_ORG_API_KEY (cron-job.org Console → Settings)}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required. Install jq and re-run." >&2
  exit 1
fi

auth_header() {
  printf 'Authorization: Bearer %s' "${CRONJOB_ORG_API_KEY}"
}

find_job_id_by_title() {
  local title="$1"
  curl -sS -H "Content-Type: application/json" -H "$(auth_header)" "${API_BASE}" \
    | jq -r --arg title "${title}" '.jobs[]? | select(.title == $title) | .jobId' \
    | head -n1
}

upsert_job() {
  local title="$1"
  local url="$2"
  local schedule="$3"
  local job_id
  job_id="$(find_job_id_by_title "${title}" || true)"

  local payload
  payload="$(jq -n \
    --arg url "${url}" \
    --arg title "${title}" \
    --arg auth "Bearer ${CRON_SECRET}" \
    --argjson schedule "${schedule}" \
    '{
      job: {
        url: $url,
        enabled: true,
        title: $title,
        saveResponses: true,
        requestMethod: 1,
        extendedData: {
          headers: {
            Authorization: $auth,
            "Content-Type": "application/json"
          }
        },
        schedule: $schedule
      }
    }')"

  if [[ -n "${job_id}" && "${job_id}" != "null" ]]; then
    echo "→ Updating cron-job.org job #${job_id}: ${title}"
    curl -sS -X PATCH \
      -H "Content-Type: application/json" \
      -H "$(auth_header)" \
      -d "${payload}" \
      "${API_BASE}/${job_id}" | jq .
  else
    echo "→ Creating cron-job.org job: ${title}"
    curl -sS -X PUT \
      -H "Content-Type: application/json" \
      -H "$(auth_header)" \
      -d "${payload}" \
      "${API_BASE}" | jq .
  fi
}

# Every 5 minutes (UTC)
RECONCILE_SCHEDULE='{
  "timezone": "UTC",
  "expiresAt": 0,
  "hours": [-1],
  "mdays": [-1],
  "minutes": [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
  "months": [-1],
  "wdays": [-1]
}'

# Daily at 00:00 UTC
TIER_SCHEDULE='{
  "timezone": "UTC",
  "expiresAt": 0,
  "hours": [0],
  "mdays": [-1],
  "minutes": [0],
  "months": [-1],
  "wdays": [-1]
}'

upsert_job "BANTAYOG reconcile" "${RAILWAY_API_URL}/api/cron/reconcile" "${RECONCILE_SCHEDULE}"
upsert_job "BANTAYOG tier-reeval" "${RAILWAY_API_URL}/api/cron/tier-reeval" "${TIER_SCHEDULE}"

echo "✓ External crons registered on cron-job.org."

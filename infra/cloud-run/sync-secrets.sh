#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
PROJECT_ID="${PROJECT_ID:-}"

if [[ $# -gt 0 ]]; then
  cat <<USAGE >&2
Usage:
  PROJECT_ID=<gcp-project> [ENV_FILE=.env] ./infra/cloud-run/sync-secrets.sh
USAGE
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  cat <<USAGE >&2
Usage:
  PROJECT_ID=<gcp-project> [ENV_FILE=.env] ./infra/cloud-run/sync-secrets.sh
USAGE
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  "${ROOT_DIR}/infra/scripts/validate-runtime-env.sh" --env-file "$ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  "${ROOT_DIR}/infra/scripts/validate-runtime-env.sh"
fi

secret_names=(
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  POSTGRES_URL
  CRON_SECRET
  BETTER_AUTH_SECRET
  ADMIN_WALLETS
  KUEST_ADDRESS
  KUEST_API_KEY
  KUEST_API_SECRET
  KUEST_PASSPHRASE
)

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required." >&2
  exit 1
fi

for secret_name in "${secret_names[@]}"; do
  secret_value="${!secret_name:-}"

  if [[ -z "$secret_value" ]]; then
    continue
  fi

  if ! gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" --replication-policy automatic --project "$PROJECT_ID"
  fi

  printf '%s' "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=- --project "$PROJECT_ID"
  echo "Synced secret: ${secret_name}"
done

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
FLY_APP="${FLY_APP:-}"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ -z "$FLY_APP" ]]; then
  cat <<USAGE >&2
Usage:
  FLY_APP=<fly-app-name> [ENV_FILE=.env] ./infra/fly/sync-secrets.sh [--dry-run]
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

required_vars=(
  SITE_URL
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  POSTGRES_URL
  CRON_SECRET
  BETTER_AUTH_SECRET
  NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID
  KUEST_ADDRESS
  KUEST_API_KEY
  KUEST_API_SECRET
  KUEST_PASSPHRASE
)

optional_vars=(
  POSTGRES_URL_NON_POOLING
  ADMIN_WALLETS
  CLOB_URL
  RELAYER_URL
  DATA_URL
  USER_PNL_URL
  COMMUNITY_URL
  WS_CLOB_URL
  WS_LIVE_DATA_URL
  NEXT_PUBLIC_FORK_OWNER_GUIDE
)

secret_pairs=()
for key in "${required_vars[@]}"; do
  secret_pairs+=("${key}=${!key}")
done

for key in "${optional_vars[@]}"; do
  value="${!key:-}"
  if [[ -n "$value" ]]; then
    secret_pairs+=("${key}=${value}")
  fi
done

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run: would set these Fly secrets on app ${FLY_APP}:"
  for key in "${required_vars[@]}"; do
    echo "- ${key}"
  done
  for key in "${optional_vars[@]}"; do
    value="${!key:-}"
    if [[ -n "$value" ]]; then
      echo "- ${key}"
    fi
  done
  exit 0
fi

if ! command -v flyctl >/dev/null 2>&1; then
  echo "flyctl CLI is required." >&2
  exit 1
fi

cmd=(
  flyctl secrets set
  --app "$FLY_APP"
)

for pair in "${secret_pairs[@]}"; do
  cmd+=("$pair")
done

"${cmd[@]}"

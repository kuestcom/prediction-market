#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
FLY_APP="${FLY_APP:-}"

if [[ $# -gt 0 ]]; then
  cat <<USAGE >&2
Usage:
  FLY_APP=<fly-app-name> [ENV_FILE=.env] ./infra/fly/sync-secrets.sh
USAGE
  exit 1
fi

if [[ -z "$FLY_APP" ]]; then
  cat <<USAGE >&2
Usage:
  FLY_APP=<fly-app-name> [ENV_FILE=.env] ./infra/fly/sync-secrets.sh
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
  ADMIN_WALLETS
  NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID
  KUEST_ADDRESS
  KUEST_API_KEY
  KUEST_API_SECRET
  KUEST_PASSPHRASE
)

secret_pairs=()
for key in "${required_vars[@]}"; do
  secret_pairs+=("${key}=${!key}")
done

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

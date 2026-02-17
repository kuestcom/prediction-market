#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-kuest-web}"
IMAGE_REF="${IMAGE_REF:-}"
CLOUD_RUN_SECRET_VERSION="${CLOUD_RUN_SECRET_VERSION:-latest}"
SKIP_RUNTIME_ENV_VALIDATION="${SKIP_RUNTIME_ENV_VALIDATION:-0}"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ -z "$PROJECT_ID" || -z "$REGION" || -z "$IMAGE_REF" ]]; then
  cat <<USAGE >&2
Usage:
  PROJECT_ID=<gcp-project> REGION=<gcp-region> IMAGE_REF=<registry/image:tag-or-digest> [CLOUD_RUN_SERVICE=kuest-web] [ENV_FILE=.env] ./infra/cloud-run/deploy.sh [--dry-run]
USAGE
  exit 1
fi

if [[ "$SKIP_RUNTIME_ENV_VALIDATION" != "1" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    "${ROOT_DIR}/infra/scripts/validate-runtime-env.sh" --env-file "$ENV_FILE"
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  else
    "${ROOT_DIR}/infra/scripts/validate-runtime-env.sh"
  fi
fi

"${ROOT_DIR}/infra/scripts/validate-image-ref.sh" "$IMAGE_REF"

add_env_if_set() {
  local key="$1"
  local value="${!key:-}"
  if [[ -n "$value" ]]; then
    public_env+=("${key}=${value}")
  fi
}

public_env=(
  "NODE_ENV=production"
)

add_env_if_set SITE_URL
add_env_if_set SUPABASE_URL
add_env_if_set NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID
add_env_if_set NEXT_PUBLIC_FORK_OWNER_GUIDE
add_env_if_set CLOB_URL
add_env_if_set RELAYER_URL
add_env_if_set DATA_URL
add_env_if_set USER_PNL_URL
add_env_if_set COMMUNITY_URL
add_env_if_set WS_CLOB_URL
add_env_if_set WS_LIVE_DATA_URL

secret_mappings=(
  "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:${CLOUD_RUN_SECRET_VERSION}"
  "POSTGRES_URL=POSTGRES_URL:${CLOUD_RUN_SECRET_VERSION}"
  "CRON_SECRET=CRON_SECRET:${CLOUD_RUN_SECRET_VERSION}"
  "BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:${CLOUD_RUN_SECRET_VERSION}"
  "KUEST_ADDRESS=KUEST_ADDRESS:${CLOUD_RUN_SECRET_VERSION}"
  "KUEST_API_KEY=KUEST_API_KEY:${CLOUD_RUN_SECRET_VERSION}"
  "KUEST_API_SECRET=KUEST_API_SECRET:${CLOUD_RUN_SECRET_VERSION}"
  "KUEST_PASSPHRASE=KUEST_PASSPHRASE:${CLOUD_RUN_SECRET_VERSION}"
)

if [[ -n "${POSTGRES_URL_NON_POOLING:-}" ]]; then
  secret_mappings+=("POSTGRES_URL_NON_POOLING=POSTGRES_URL_NON_POOLING:${CLOUD_RUN_SECRET_VERSION}")
fi

if [[ -n "${ADMIN_WALLETS:-}" ]]; then
  secret_mappings+=("ADMIN_WALLETS=ADMIN_WALLETS:${CLOUD_RUN_SECRET_VERSION}")
fi

public_env_csv="$(IFS=,; echo "${public_env[*]}")"
secret_mapping_csv="$(IFS=,; echo "${secret_mappings[*]}")"

cmd=(
  gcloud run deploy "$CLOUD_RUN_SERVICE"
  --project "$PROJECT_ID"
  --region "$REGION"
  --platform managed
  --image "$IMAGE_REF"
  --allow-unauthenticated
  --port 3000
  --set-env-vars "$public_env_csv"
  --update-secrets "$secret_mapping_csv"
)

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run command:"
  printf '  %q' "${cmd[@]}"
  printf '\n'
  exit 0
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required." >&2
  exit 1
fi

"${cmd[@]}"

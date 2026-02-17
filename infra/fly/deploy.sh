#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
FLY_CONFIG="${FLY_CONFIG:-${ROOT_DIR}/infra/fly/fly.toml}"
FLY_APP="${FLY_APP:-}"
IMAGE_REF="${IMAGE_REF:-}"
SKIP_RUNTIME_ENV_VALIDATION="${SKIP_RUNTIME_ENV_VALIDATION:-0}"

if [[ $# -gt 0 ]]; then
  cat <<USAGE >&2
Usage:
  IMAGE_REF=<registry/image:tag-or-digest> [FLY_APP=kuest-web] [ENV_FILE=.env] ./infra/fly/deploy.sh
USAGE
  exit 1
fi

if [[ -z "$IMAGE_REF" ]]; then
  cat <<USAGE >&2
Usage:
  IMAGE_REF=<registry/image:tag-or-digest> [FLY_APP=kuest-web] [ENV_FILE=.env] ./infra/fly/deploy.sh
USAGE
  exit 1
fi

if [[ "$SKIP_RUNTIME_ENV_VALIDATION" != "1" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    "${ROOT_DIR}/infra/scripts/validate-runtime-env.sh" --env-file "$ENV_FILE"
  else
    "${ROOT_DIR}/infra/scripts/validate-runtime-env.sh"
  fi
fi

"${ROOT_DIR}/infra/scripts/validate-image-ref.sh" "$IMAGE_REF"

cmd=(
  flyctl deploy
  --config "$FLY_CONFIG"
  --image "$IMAGE_REF"
  --remote-only
  --strategy rolling
)

if [[ -n "$FLY_APP" ]]; then
  cmd+=(--app "$FLY_APP")
fi

if ! command -v flyctl >/dev/null 2>&1; then
  echo "flyctl CLI is required." >&2
  exit 1
fi

"${cmd[@]}"

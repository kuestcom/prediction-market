#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REQUIRED_VARS_FILE="${ROOT_DIR}/infra/scripts/required-runtime-env.txt"

ENV_FILE=""
PRINT_REQUIRED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --print-required)
      PRINT_REQUIRED=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$REQUIRED_VARS_FILE" ]]; then
  echo "Missing required vars file: $REQUIRED_VARS_FILE" >&2
  exit 1
fi

if [[ "$PRINT_REQUIRED" -eq 1 ]]; then
  cat "$REQUIRED_VARS_FILE"
  exit 0
fi

if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

missing=()
while IFS= read -r var_name || [[ -n "$var_name" ]]; do
  [[ -z "$var_name" ]] && continue
  [[ "$var_name" =~ ^# ]] && continue

  value="${!var_name:-}"
  if [[ -z "$value" ]]; then
    missing+=("$var_name")
  fi
done < "$REQUIRED_VARS_FILE"

if (( ${#missing[@]} > 0 )); then
  echo "Missing required runtime env vars:" >&2
  for name in "${missing[@]}"; do
    echo "- $name" >&2
  done
  exit 1
fi

echo "Runtime env validation passed (${REQUIRED_VARS_FILE})."

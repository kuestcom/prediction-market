#!/usr/bin/env bash
set -euo pipefail

IMAGE_REF="${1:-}"

if [[ -z "$IMAGE_REF" ]]; then
  echo "Usage: validate-image-ref.sh <image-reference>" >&2
  exit 1
fi

if [[ "$IMAGE_REF" == *@sha256:* ]]; then
  echo "Image reference validation passed (digest)."
  exit 0
fi

if [[ "$IMAGE_REF" =~ :([^:@/]+)$ ]]; then
  tag="${BASH_REMATCH[1]}"

  if [[ "$tag" == "latest" ]]; then
    echo "Mutable tag 'latest' is not allowed for production deploys." >&2
    exit 1
  fi

  echo "Image reference validation passed (pinned tag: ${tag})."
  exit 0
fi

echo "Image reference must include an explicit version tag or digest." >&2
exit 1

const NEXT_HTTP_ERROR_FALLBACK_PREFIX = 'NEXT_HTTP_ERROR_FALLBACK;'

function getErrorDigest(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const record = error as { digest?: unknown }
  return typeof record.digest === 'string' ? record.digest : null
}

export function getNextHttpFallbackStatus(error: unknown) {
  const digest = getErrorDigest(error)
  if (!digest || !digest.startsWith(NEXT_HTTP_ERROR_FALLBACK_PREFIX)) {
    return null
  }

  const status = Number.parseInt(digest.slice(NEXT_HTTP_ERROR_FALLBACK_PREFIX.length), 10)
  return Number.isFinite(status) ? status : null
}

export function isNextNotFoundError(error: unknown) {
  return getNextHttpFallbackStatus(error) === 404
}

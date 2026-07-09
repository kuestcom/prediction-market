const staleAssetErrorPatterns = [
  /ChunkLoadError/i,
  /Loading chunk .+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /module factory is not available/i,
  /was instantiated because it was required from module/i,
]

function collectErrorMessages(value: unknown, seen = new Set<unknown>()): string[] {
  if (!value || seen.has(value)) {
    return []
  }

  if (typeof value === 'string') {
    return [value]
  }

  if (typeof value !== 'object') {
    return []
  }

  seen.add(value)

  const messages: string[] = []
  const errorLike = value as {
    cause?: unknown
    digest?: unknown
    error?: unknown
    message?: unknown
    name?: unknown
    reason?: unknown
    stack?: unknown
  }

  for (const field of [errorLike.name, errorLike.message, errorLike.stack, errorLike.digest]) {
    if (typeof field === 'string' && field.trim()) {
      messages.push(field)
    }
  }

  messages.push(...collectErrorMessages(errorLike.error, seen))
  messages.push(...collectErrorMessages(errorLike.reason, seen))
  messages.push(...collectErrorMessages(errorLike.cause, seen))

  return messages
}

export function isNextStaticAssetUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return false
  }

  try {
    return new URL(value, typeof window === 'undefined' ? 'https://example.com' : window.location.origin)
      .pathname
      .startsWith('/_next/static/')
  }
  catch {
    return value.includes('/_next/static/')
  }
}

function isNextStaticAssetEvent(event: unknown) {
  if (typeof event !== 'object' || event === null || !('target' in event)) {
    return false
  }

  const target = (event as { target?: { href?: unknown, src?: unknown } | null }).target
  return isNextStaticAssetUrl(target?.src) || isNextStaticAssetUrl(target?.href)
}

export function isNextClientStaleAssetError(error: unknown) {
  if (isNextStaticAssetEvent(error)) {
    return true
  }

  const message = collectErrorMessages(error).join('\n')
  if (!message) {
    return false
  }

  return staleAssetErrorPatterns.some(pattern => pattern.test(message))
}

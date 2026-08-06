const NEXT_CLIENT_STALE_ASSET_RELOAD_PREFIX = 'next-client-stale-asset-reload'

const staleAssetErrorPatterns = [
  /ChunkLoadError/i,
  /Failed to load chunk/i,
  /Loading chunk .+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /module factory is not available/i,
  /was instantiated because it was required from module/i,
]

const inMemoryReloadKeys = new Set<string>()

interface ReloadOptions {
  deploymentId?: string
  reload?: () => void
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

function readStorage(storage: ReloadOptions['storage'], key: string) {
  if (!storage) {
    return inMemoryReloadKeys.has(key)
  }

  try {
    return storage.getItem(key) !== null || inMemoryReloadKeys.has(key)
  } catch {
    return inMemoryReloadKeys.has(key)
  }
}

function writeStorage(storage: ReloadOptions['storage'], key: string) {
  if (!storage) {
    inMemoryReloadKeys.add(key)
    return
  }

  try {
    storage.setItem(key, '1')
  } catch {
    inMemoryReloadKeys.add(key)
  }
}

function getCurrentStorage(storage?: ReloadOptions['storage']) {
  if (storage) {
    return storage
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

function getDeploymentId(deploymentId?: string) {
  const explicitDeploymentId = deploymentId?.trim()
  if (explicitDeploymentId) {
    return explicitDeploymentId
  }

  if (typeof document !== 'undefined') {
    const documentDeploymentId = document.documentElement.getAttribute('data-dpl-id')?.trim()
    if (documentDeploymentId) {
      return documentDeploymentId
    }
  }

  return process.env.COMMIT_SHA?.trim() || 'unknown'
}

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
    return new URL(
      value,
      typeof window === 'undefined' ? 'https://example.com' : window.location.origin,
    ).pathname.startsWith('/_next/static/')
  } catch {
    return value.includes('/_next/static/')
  }
}

function isNextStaticAssetEvent(event: unknown) {
  if (typeof event !== 'object' || event === null || !('target' in event)) {
    return false
  }

  const target = (event as { target?: { href?: unknown; src?: unknown } | null }).target
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

  return staleAssetErrorPatterns.some((pattern) => pattern.test(message))
}

export function requestNextClientStaleAssetReload(options: ReloadOptions = {}) {
  const reload = options.reload ?? (typeof window === 'undefined' ? undefined : () => window.location.reload())
  if (!reload) {
    return false
  }

  const reloadKey = `${NEXT_CLIENT_STALE_ASSET_RELOAD_PREFIX}:${getDeploymentId(options.deploymentId)}`
  const storage = getCurrentStorage(options.storage)
  if (readStorage(storage, reloadKey)) {
    return false
  }

  writeStorage(storage, reloadKey)
  reload()
  return true
}

function handleWindowError(event: ErrorEvent | Event) {
  const error = 'error' in event ? event.error : undefined
  const message = 'message' in event ? event.message : undefined

  if (
    isNextClientStaleAssetError(event) ||
    isNextClientStaleAssetError(error) ||
    isNextClientStaleAssetError(message)
  ) {
    requestNextClientStaleAssetReload()
  }
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
  if (isNextClientStaleAssetError(event.reason)) {
    requestNextClientStaleAssetReload()
  }
}

let reloadHandlersInstalled = false

export function installNextClientStaleAssetReloadHandlers() {
  if (typeof window === 'undefined' || reloadHandlersInstalled) {
    return
  }

  reloadHandlersInstalled = true
  window.addEventListener('error', handleWindowError, true)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
}

const STALE_NEXT_CLIENT_ASSET_RELOAD_PREFIX = 'next-stale-client-asset-reload'

const staleAssetErrorPatterns = [
  /ChunkLoadError/i,
  /Loading chunk .+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /module factory is not available/i,
  /was instantiated because it was required from module/i,
]

const inMemoryReloadKeys = new Set<string>()

interface ReloadOptions {
  buildId?: string
  location?: Pick<Location, 'pathname' | 'search'>
  reload?: () => void
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

function readStorage(storage: ReloadOptions['storage'], key: string) {
  if (!storage) {
    return inMemoryReloadKeys.has(key) ? '1' : null
  }

  try {
    return storage.getItem(key) ?? null
  }
  catch {
    return inMemoryReloadKeys.has(key) ? '1' : null
  }
}

function writeStorage(storage: ReloadOptions['storage'], key: string) {
  if (!storage) {
    inMemoryReloadKeys.add(key)
    return
  }

  try {
    storage.setItem(key, '1')
  }
  catch {
    inMemoryReloadKeys.add(key)
  }
}

function getBuildId(buildId?: string) {
  if (buildId && buildId.trim()) {
    return buildId.trim()
  }

  return process.env.COMMIT_SHA || 'unknown'
}

function getCurrentLocation(location?: ReloadOptions['location']) {
  if (location) {
    return location
  }

  if (typeof window === 'undefined') {
    return null
  }

  return window.location
}

function getCurrentStorage(storage?: ReloadOptions['storage']) {
  if (storage) {
    return storage
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  }
  catch {
    return null
  }
}

function getReloadKey(options: ReloadOptions) {
  const location = getCurrentLocation(options.location)
  if (!location) {
    return null
  }

  const buildId = getBuildId(options.buildId)
  return `${STALE_NEXT_CLIENT_ASSET_RELOAD_PREFIX}:${buildId}:${location.pathname}${location.search}`
}

function getReloadFn(reload?: () => void) {
  if (reload) {
    return reload
  }

  if (typeof window === 'undefined') {
    return null
  }

  return () => window.location.reload()
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

export function isStaleNextClientAssetError(error: unknown) {
  if (isNextStaticAssetEvent(error)) {
    return true
  }

  const message = collectErrorMessages(error).join('\n')
  if (!message) {
    return false
  }

  return staleAssetErrorPatterns.some(pattern => pattern.test(message))
}

export function requestStaleNextClientAssetReload(options: ReloadOptions = {}) {
  const reload = getReloadFn(options.reload)
  const key = getReloadKey(options)
  if (!reload || !key) {
    return false
  }

  const storage = getCurrentStorage(options.storage) ?? undefined
  if (readStorage(storage, key)) {
    return false
  }

  writeStorage(storage, key)
  reload()
  return true
}

function handleWindowError(event: ErrorEvent | Event) {
  const error = 'error' in event ? event.error : event
  const message = 'message' in event ? event.message : undefined

  if (isStaleNextClientAssetError(event) || isStaleNextClientAssetError(error) || isStaleNextClientAssetError(message)) {
    requestStaleNextClientAssetReload()
  }
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
  if (isStaleNextClientAssetError(event.reason)) {
    requestStaleNextClientAssetReload()
  }
}

let staleNextClientAssetReloadHandlersInstalled = false

export function installStaleNextClientAssetReloadHandlers() {
  if (typeof window === 'undefined' || staleNextClientAssetReloadHandlersInstalled) {
    return
  }

  staleNextClientAssetReloadHandlersInstalled = true
  window.addEventListener('error', handleWindowError, true)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
}

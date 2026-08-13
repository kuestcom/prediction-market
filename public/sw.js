const TRADE_ALERT_DATABASE = 'kuest-trade-alerts'
const TRADE_ALERT_DATABASE_VERSION = 1
const TRADE_ALERT_STORE = 'alerts'
const TRADE_ALERT_META_STORE = 'meta'
const TRADE_ALERT_MAX_TTL_MS = 15 * 60 * 1000
const TRADE_ALERT_RETENTION_MS = 24 * 60 * 60 * 1000

globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})

function resolveSafeNotificationUrl(rawUrl) {
  const fallbackUrl = `${globalThis.location.origin}/`
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return fallbackUrl
  }
  try {
    const parsedUrl = new URL(rawUrl, globalThis.location.origin)
    if (parsedUrl.origin !== globalThis.location.origin) {
      return fallbackUrl
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return fallbackUrl
    }
    return parsedUrl.toString()
  } catch {
    return fallbackUrl
  }
}

function openTradeAlertsDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRADE_ALERT_DATABASE, TRADE_ALERT_DATABASE_VERSION)
    request.onerror = () => reject(request.error || new Error('Could not open trade alert storage'))
    request.onupgradeneeded = () => {
      const database = request.result
      const alerts = database.objectStoreNames.contains(TRADE_ALERT_STORE)
        ? request.transaction.objectStore(TRADE_ALERT_STORE)
        : database.createObjectStore(TRADE_ALERT_STORE, { keyPath: ['partition', 'notification_id'] })
      if (!alerts.indexNames.contains('partition_created_at')) {
        alerts.createIndex('partition_created_at', ['partition', 'created_at_ms'])
      }
      if (!database.objectStoreNames.contains(TRADE_ALERT_META_STORE)) {
        database.createObjectStore(TRADE_ALERT_META_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve
    transaction.onabort = () => reject(transaction.error || new Error('Trade alert transaction aborted'))
    transaction.onerror = () => reject(transaction.error || new Error('Trade alert transaction failed'))
  })
}

function parseTradeAlert(raw) {
  const data = raw && typeof raw === 'object' && raw.payload && typeof raw.payload === 'object' ? raw.payload : raw
  if (!data || typeof data !== 'object') {
    return null
  }
  const required = [
    'notification_id',
    'profile_id',
    'followed_wallet',
    'condition_id',
    'message',
    'market_title',
    'url',
    'created_at',
    'expires_at',
  ]
  if (required.some((key) => typeof data[key] !== 'string' || !data[key].trim())) {
    return null
  }
  const createdAt = Date.parse(data.created_at)
  const expiresAt = Date.parse(data.expires_at)
  const now = Date.now()
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) {
    return null
  }
  if (createdAt > now + 60_000 || expiresAt <= now || expiresAt - createdAt > TRADE_ALERT_MAX_TTL_MS) {
    return null
  }
  return {
    ...data,
    followed_wallet: data.followed_wallet.toLowerCase(),
    condition_id: data.condition_id.toLowerCase(),
    url: resolveSafeNotificationUrl(data.url),
    partition: `${globalThis.location.origin}\u0000${data.profile_id}`,
    created_at_ms: createdAt,
    read: false,
  }
}

async function persistTradeAlert(alert) {
  const database = await openTradeAlertsDatabase()
  const cleanupTransaction = database.transaction(TRADE_ALERT_STORE, 'readwrite')
  const cleanupCompleted = transactionComplete(cleanupTransaction)
  const cleanupRequest = cleanupTransaction.objectStore(TRADE_ALERT_STORE).openCursor()
  const cutoff = Date.now() - TRADE_ALERT_RETENTION_MS
  await new Promise((resolve, reject) => {
    cleanupRequest.onerror = () => reject(cleanupRequest.error || new Error('Could not clean trade alerts'))
    cleanupRequest.onsuccess = () => {
      const cursor = cleanupRequest.result
      if (!cursor) {
        resolve()
        return
      }
      if (Number(cursor.value?.created_at_ms) < cutoff) {
        cursor.delete()
      }
      cursor.continue()
    }
  })
  await cleanupCompleted

  const transaction = database.transaction(TRADE_ALERT_STORE, 'readwrite')
  const completed = transactionComplete(transaction)
  const store = transaction.objectStore(TRADE_ALERT_STORE)
  const key = [alert.partition, alert.notification_id]
  const existing = await new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  if (!existing) {
    store.add(alert)
  }
  await completed
  database.close()
  return !existing
}

async function setNeedsSync() {
  const database = await openTradeAlertsDatabase()
  const transaction = database.transaction(TRADE_ALERT_META_STORE, 'readwrite')
  const completed = transactionComplete(transaction)
  transaction.objectStore(TRADE_ALERT_META_STORE).put({ key: 'push_subscription_needs_sync', value: true })
  await completed
  database.close()
}

globalThis.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }
  event.waitUntil(
    (async () => {
      let raw
      try {
        raw = event.data.json()
      } catch {
        return
      }
      const alert = parseTradeAlert(raw)
      if (!alert) {
        return
      }
      const windowClients = await globalThis.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const visibleClients = windowClients.filter((client) => client.visibilityState === 'visible')
      if (visibleClients.length > 0) {
        const focusedClient = visibleClients.find((client) => client.focused) || visibleClients[0]
        focusedClient.postMessage({ type: 'TRADE_ALERT', payload: alert })
        return
      }
      const isNew = await persistTradeAlert(alert)
      if (!isNew) {
        return
      }
      await globalThis.registration.showNotification(alert.message, {
        body: alert.market_title,
        icon: alert.icon || '/images/pwa/default-icon-192.png',
        badge: alert.badge || alert.icon || '/images/pwa/default-icon-192.png',
        image: alert.market_icon || undefined,
        tag: alert.notification_id,
        renotify: false,
        data: { url: alert.url, notification_id: alert.notification_id },
      })
    })(),
  )
})

globalThis.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      await setNeedsSync()
      const windowClients = await globalThis.clients.matchAll({ type: 'window', includeUncontrolled: true })
      await Promise.all(windowClients.map((client) => client.postMessage({ type: 'TRADE_ALERT_SUBSCRIPTION_CHANGED' })))
    })(),
  )
})

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = resolveSafeNotificationUrl(event.notification.data?.url)
  event.waitUntil(
    (async () => {
      const windowClients = await globalThis.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windowClients) {
        if ('focus' in client && 'navigate' in client) {
          try {
            if (client.url !== targetUrl) {
              await client.navigate(targetUrl)
            }
            await client.focus()
            return
          } catch {
            // Try the next client or open a new window.
          }
        }
      }
      await globalThis.clients.openWindow?.(targetUrl)
    })(),
  )
})

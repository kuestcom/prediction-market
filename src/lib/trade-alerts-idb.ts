import type { StoredTradeAlert, TradeAlertPayload } from '@/lib/trade-alerts'

import { TRADE_ALERT_RETENTION_MS, tradeAlertPartition } from '@/lib/trade-alerts'

const DATABASE_NAME = 'kuest-trade-alerts'
const DATABASE_VERSION = 1
const ALERT_STORE = 'alerts'
const META_STORE = 'meta'
const PARTITION_CREATED_INDEX = 'partition_created_at'

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  })
}

function openTradeAlertsDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Could not open trade alerts database'))
    request.onupgradeneeded = () => {
      const database = request.result
      const alerts = database.objectStoreNames.contains(ALERT_STORE)
        ? request.transaction!.objectStore(ALERT_STORE)
        : database.createObjectStore(ALERT_STORE, { keyPath: ['partition', 'notification_id'] })

      if (!alerts.indexNames.contains(PARTITION_CREATED_INDEX)) {
        alerts.createIndex(PARTITION_CREATED_INDEX, ['partition', 'created_at_ms'])
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export async function putTradeAlert(
  payload: TradeAlertPayload,
  options: { origin: string; read?: boolean; now?: number },
) {
  const database = await openTradeAlertsDatabase()
  const transaction = database.transaction(ALERT_STORE, 'readwrite')
  const completed = transactionComplete(transaction)
  const store = transaction.objectStore(ALERT_STORE)
  const partition = tradeAlertPartition(options.origin, payload.profile_id)
  const key: [string, string] = [partition, payload.notification_id]
  const existing = await requestResult(store.get(key) as IDBRequest<StoredTradeAlert | undefined>)

  if (existing) {
    await completed
    database.close()
    return { alert: existing, isNew: false }
  }

  const createdAtMs = Date.parse(payload.created_at)
  const alert: StoredTradeAlert = {
    ...payload,
    partition,
    read: options.read ?? false,
    created_at_ms: Number.isFinite(createdAtMs) ? createdAtMs : (options.now ?? Date.now()),
  }
  store.add(alert)
  await completed
  database.close()
  return { alert, isNew: true }
}

export async function cleanupTradeAlerts(now = Date.now()) {
  const database = await openTradeAlertsDatabase()
  const transaction = database.transaction(ALERT_STORE, 'readwrite')
  const completed = transactionComplete(transaction)
  const store = transaction.objectStore(ALERT_STORE)
  const request = store.openCursor()
  const cutoff = now - TRADE_ALERT_RETENTION_MS

  await new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Could not clean trade alerts'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      const alert = cursor.value as StoredTradeAlert
      if (alert.created_at_ms < cutoff) {
        cursor.delete()
      }
      cursor.continue()
    }
  })

  await completed
  database.close()
}

export async function listTradeAlerts(origin: string, profileId: string, now = Date.now()) {
  await cleanupTradeAlerts(now)
  const database = await openTradeAlertsDatabase()
  const transaction = database.transaction(ALERT_STORE, 'readonly')
  const completed = transactionComplete(transaction)
  const partition = tradeAlertPartition(origin, profileId)
  const range = IDBKeyRange.bound([partition, 0], [partition, Number.MAX_SAFE_INTEGER])
  const alerts = await requestResult(transaction.objectStore(ALERT_STORE).index(PARTITION_CREATED_INDEX).getAll(range))
  await completed
  database.close()
  return (alerts as StoredTradeAlert[]).sort((first, second) => second.created_at_ms - first.created_at_ms)
}

export async function markTradeAlertsRead(origin: string, profileId: string) {
  const database = await openTradeAlertsDatabase()
  const transaction = database.transaction(ALERT_STORE, 'readwrite')
  const completed = transactionComplete(transaction)
  const store = transaction.objectStore(ALERT_STORE)
  const partition = tradeAlertPartition(origin, profileId)
  const request = store.openCursor()

  await new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Could not mark trade alerts read'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      const alert = cursor.value as StoredTradeAlert
      if (alert.partition === partition && !alert.read) {
        cursor.update({ ...alert, read: true })
      }
      cursor.continue()
    }
  })

  await completed
  database.close()
}

export async function setTradeAlertsNeedsSync(needsSync: boolean) {
  const database = await openTradeAlertsDatabase()
  const transaction = database.transaction(META_STORE, 'readwrite')
  const completed = transactionComplete(transaction)
  transaction.objectStore(META_STORE).put({ key: 'push_subscription_needs_sync', value: needsSync })
  await completed
  database.close()
}

export async function getTradeAlertsNeedsSync() {
  const database = await openTradeAlertsDatabase()
  const transaction = database.transaction(META_STORE, 'readonly')
  const completed = transactionComplete(transaction)
  const row = await requestResult(
    transaction.objectStore(META_STORE).get('push_subscription_needs_sync') as IDBRequest<
      { key: string; value: boolean } | undefined
    >,
  )
  await completed
  database.close()
  return row?.value === true
}

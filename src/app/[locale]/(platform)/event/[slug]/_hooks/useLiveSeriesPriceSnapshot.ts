import type { LiveSeriesPriceSnapshot, PersistedLivePrice } from '../_utils/eventLiveSeriesChartUtils'
import type { EventLiveChartConfig } from '@/types'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import {
  LIVE_DATA_RETENTION_MS,
  normalizeLiveChartPrice,
  readPersistedLivePrice,
  writePersistedLivePrice,
} from '../_utils/eventLiveSeriesChartUtils'

interface UseLiveSeriesPriceSnapshotOptions {
  config: EventLiveChartConfig
  subscriptionSymbol: string
  explicitEndTimestamp: number | null
  startTimestamp: number | null
}

export interface LiveSeriesPriceSnapshotResult {
  referenceSnapshot: LiveSeriesPriceSnapshot | null
  baselinePrice: number | null
  setBaselinePrice: React.Dispatch<React.SetStateAction<number | null>>
  persistedFallbackPrice: PersistedLivePrice | null
}

interface LiveSeriesPriceSnapshotStoreSnapshot {
  referenceSnapshot: LiveSeriesPriceSnapshot | null
  persistedFallbackPrice: PersistedLivePrice | null
}

interface LiveSeriesPriceSnapshotStoreEntry {
  snapshot: LiveSeriesPriceSnapshotStoreSnapshot
  inflightFetch: Promise<void> | null
  abortController: AbortController | null
  fetchToken: number
  listeners: Set<() => void>
}

interface LiveSeriesPriceSnapshotRequest {
  seriesSlug: string
  topic: string
  subscriptionSymbol: string
  activeWindowMinutes: number
  explicitEndTimestamp: number
  startTimestamp: number | null
}

const liveSeriesPriceSnapshotStores = new Map<string, LiveSeriesPriceSnapshotStoreEntry>()
const liveSeriesPriceStorageKeyPrefix = 'kuest-live-last-price'
const LIVE_SERIES_PRICE_SNAPSHOT_STORE_TTL_MS = 10 * 60 * 1000
const EMPTY_LIVE_SERIES_PRICE_SNAPSHOT: LiveSeriesPriceSnapshotStoreSnapshot = {
  referenceSnapshot: null,
  persistedFallbackPrice: null,
}

function buildLiveSeriesPriceSnapshotStoreKey({
  seriesSlug,
  topic,
  subscriptionSymbol,
  activeWindowMinutes,
  explicitEndTimestamp,
  startTimestamp,
}: LiveSeriesPriceSnapshotRequest) {
  return [
    seriesSlug,
    topic.trim().toLowerCase(),
    subscriptionSymbol.trim().toLowerCase(),
    activeWindowMinutes,
    explicitEndTimestamp,
    startTimestamp ?? '',
  ].join(':')
}

function buildLiveSeriesPriceSnapshotQuery({
  seriesSlug,
  activeWindowMinutes,
  explicitEndTimestamp,
  startTimestamp,
}: LiveSeriesPriceSnapshotRequest) {
  const query = new URLSearchParams({
    seriesSlug,
    eventEndMs: String(explicitEndTimestamp),
    activeWindowMinutes: String(activeWindowMinutes),
  })

  if (startTimestamp != null && startTimestamp > 0 && startTimestamp < explicitEndTimestamp) {
    query.set('eventStartMs', String(startTimestamp))
  }

  return query
}

function buildPersistedLivePriceStorageKey(topic: string, symbol: string) {
  return `${liveSeriesPriceStorageKeyPrefix}:${topic.trim().toLowerCase()}:${symbol.trim().toUpperCase()}`
}

function getLiveSeriesPriceSnapshotStoreEntry(storeKey: string) {
  const existingEntry = liveSeriesPriceSnapshotStores.get(storeKey)
  if (existingEntry) {
    return existingEntry
  }

  const nextEntry: LiveSeriesPriceSnapshotStoreEntry = {
    snapshot: EMPTY_LIVE_SERIES_PRICE_SNAPSHOT,
    inflightFetch: null,
    abortController: null,
    fetchToken: 0,
    listeners: new Set(),
  }
  liveSeriesPriceSnapshotStores.set(storeKey, nextEntry)
  return nextEntry
}

function pruneLiveSeriesPriceSnapshotStores() {
  const nowMs = Date.now()

  for (const [storeKey, entry] of liveSeriesPriceSnapshotStores.entries()) {
    if (entry.listeners.size > 0) {
      continue
    }

    if (entry.inflightFetch || entry.abortController) {
      continue
    }

    const snapshot = entry.snapshot.referenceSnapshot
    if (!snapshot) {
      liveSeriesPriceSnapshotStores.delete(storeKey)
      continue
    }

    const snapshotTimestamp = Math.max(
      snapshot.latest_source_timestamp_ms ?? 0,
      snapshot.event_window_end_ms ?? 0,
      snapshot.event_window_start_ms ?? 0,
      entry.snapshot.persistedFallbackPrice?.timestamp ?? 0,
    )

    if (snapshotTimestamp > 0 && nowMs - snapshotTimestamp > LIVE_SERIES_PRICE_SNAPSHOT_STORE_TTL_MS) {
      liveSeriesPriceSnapshotStores.delete(storeKey)
    }
  }
}

function arePersistedFallbackPricesEqual(
  a: PersistedLivePrice | null,
  b: PersistedLivePrice | null,
) {
  return Object.is(a?.price ?? null, b?.price ?? null)
    && Object.is(a?.timestamp ?? null, b?.timestamp ?? null)
}

function syncPersistedLivePriceSnapshot(
  storeKey: string,
  request: LiveSeriesPriceSnapshotRequest,
) {
  if (typeof window === 'undefined') {
    return false
  }

  const entry = getLiveSeriesPriceSnapshotStoreEntry(storeKey)
  const nextPersistedFallbackPrice = readPersistedLivePrice(request.topic, request.subscriptionSymbol)

  if (arePersistedFallbackPricesEqual(entry.snapshot.persistedFallbackPrice, nextPersistedFallbackPrice)) {
    return false
  }

  entry.snapshot = {
    ...entry.snapshot,
    persistedFallbackPrice: nextPersistedFallbackPrice,
  }

  return true
}

function notifyLiveSeriesPriceSnapshotStore(storeKey: string) {
  const entry = liveSeriesPriceSnapshotStores.get(storeKey)
  if (!entry) {
    return
  }

  for (const listener of entry.listeners) {
    listener()
  }

  pruneLiveSeriesPriceSnapshotStores()
}

async function fetchLiveSeriesPriceSnapshot(
  storeKey: string,
  request: LiveSeriesPriceSnapshotRequest,
) {
  const entry = getLiveSeriesPriceSnapshotStoreEntry(storeKey)
  if (entry.inflightFetch) {
    return entry.inflightFetch
  }

  const controller = new AbortController()
  const requestToken = entry.fetchToken + 1
  entry.fetchToken = requestToken
  entry.abortController = controller
  entry.inflightFetch = (async function runLiveSeriesPriceSnapshotFetch() {
    try {
      const response = await fetch(`/api/price-reference/live-series?${buildLiveSeriesPriceSnapshotQuery(request).toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        return
      }

      const payload = await response.json() as LiveSeriesPriceSnapshot
      entry.snapshot = {
        ...entry.snapshot,
        referenceSnapshot: payload,
      }

      const fallbackPrice = normalizeLiveChartPrice(
        payload.latest_price ?? payload.closing_price ?? Number.NaN,
        request.topic,
      )

      if (typeof fallbackPrice === 'number') {
        const rawFallbackTimestamp = payload.latest_source_timestamp_ms ?? payload.event_window_end_ms ?? Date.now()
        const minTimestamp = Date.now() - LIVE_DATA_RETENTION_MS + 1000
        const fallbackTimestamp = Math.max(rawFallbackTimestamp, minTimestamp)
        writePersistedLivePrice(request.topic, request.subscriptionSymbol, fallbackPrice, fallbackTimestamp)
        entry.snapshot = {
          ...entry.snapshot,
          persistedFallbackPrice: {
            price: fallbackPrice,
            timestamp: fallbackTimestamp,
          },
        }
      }
    }
    catch {
    }
    finally {
      if (entry.fetchToken === requestToken) {
        entry.inflightFetch = null
        entry.abortController = null
        notifyLiveSeriesPriceSnapshotStore(storeKey)
      }
    }
  })()

  return entry.inflightFetch
}

function subscribeToLiveSeriesPriceSnapshot(
  onStoreChange: () => void,
  request: LiveSeriesPriceSnapshotRequest,
) {
  if (typeof window === 'undefined') {
    return function unsubscribeFromLiveSeriesPriceSnapshot() {}
  }

  const storeKey = buildLiveSeriesPriceSnapshotStoreKey(request)
  const entry = getLiveSeriesPriceSnapshotStoreEntry(storeKey)
  entry.listeners.add(onStoreChange)

  if (syncPersistedLivePriceSnapshot(storeKey, request)) {
    onStoreChange()
  }
  void fetchLiveSeriesPriceSnapshot(storeKey, request)

  function handleStorage(event: StorageEvent) {
    const storageKey = event.key
    if (!storageKey) {
      return
    }

    const expectedKey = buildPersistedLivePriceStorageKey(request.topic, request.subscriptionSymbol)
    if (storageKey !== expectedKey) {
      return
    }

    if (syncPersistedLivePriceSnapshot(storeKey, request)) {
      onStoreChange()
      return
    }

    onStoreChange()
  }

  window.addEventListener('storage', handleStorage)

  return function unsubscribeFromLiveSeriesPriceSnapshot() {
    entry.listeners.delete(onStoreChange)
    if (entry.listeners.size === 0 && entry.abortController) {
      entry.fetchToken += 1
      entry.abortController.abort()
      entry.inflightFetch = null
      entry.abortController = null
      pruneLiveSeriesPriceSnapshotStores()
    }
    window.removeEventListener('storage', handleStorage)
  }
}

function getLiveSeriesPriceSnapshotSnapshot(request: LiveSeriesPriceSnapshotRequest): LiveSeriesPriceSnapshotStoreSnapshot {
  const storeKey = buildLiveSeriesPriceSnapshotStoreKey(request)
  const entry = liveSeriesPriceSnapshotStores.get(storeKey)

  if (!entry) {
    return EMPTY_LIVE_SERIES_PRICE_SNAPSHOT
  }

  return entry.snapshot
}

export function useLiveSeriesPriceSnapshot({
  config,
  subscriptionSymbol,
  explicitEndTimestamp,
  startTimestamp,
}: UseLiveSeriesPriceSnapshotOptions): LiveSeriesPriceSnapshotResult {
  const seriesSlug = config.series_slug?.trim() ?? ''
  const snapshotRequest = useMemo<LiveSeriesPriceSnapshotRequest | null>(() => {
    if (!seriesSlug) {
      return null
    }

    const snapshotEventEndMs = explicitEndTimestamp ?? Date.now()
    if (!Number.isFinite(snapshotEventEndMs) || snapshotEventEndMs <= 0) {
      return null
    }

    return {
      seriesSlug,
      topic: config.topic,
      subscriptionSymbol,
      activeWindowMinutes: config.active_window_minutes,
      explicitEndTimestamp: snapshotEventEndMs,
      startTimestamp,
    }
  }, [config.active_window_minutes, config.topic, explicitEndTimestamp, seriesSlug, startTimestamp, subscriptionSymbol])

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!snapshotRequest) {
      return function unsubscribeFromLiveSeriesPriceSnapshot() {}
    }

    return subscribeToLiveSeriesPriceSnapshot(onStoreChange, snapshotRequest)
  }, [snapshotRequest])

  const getSnapshot = useCallback(() => {
    if (!snapshotRequest) {
      return EMPTY_LIVE_SERIES_PRICE_SNAPSHOT
    }

    return getLiveSeriesPriceSnapshotSnapshot(snapshotRequest)
  }, [snapshotRequest])

  const getServerSnapshot = useCallback(() => EMPTY_LIVE_SERIES_PRICE_SNAPSHOT, [])

  const referenceSnapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const [baselinePrice, setBaselinePrice] = useState<number | null>(null)

  const effectiveBaselinePrice = baselinePrice ?? (
    typeof referenceSnapshot.referenceSnapshot?.opening_price === 'number'
    && Number.isFinite(referenceSnapshot.referenceSnapshot.opening_price)
    && referenceSnapshot.referenceSnapshot.opening_price > 0
      ? referenceSnapshot.referenceSnapshot.opening_price
      : null
  )

  return {
    referenceSnapshot: referenceSnapshot.referenceSnapshot,
    baselinePrice: effectiveBaselinePrice,
    setBaselinePrice,
    persistedFallbackPrice: referenceSnapshot.persistedFallbackPrice,
  }
}

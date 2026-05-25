import type { DataPoint } from '@/types/PredictionChartTypes'
import { useEffect, useState } from 'react'
import { closeWebSocketWhenReady, createWebSocketReconnectController } from '@/lib/websocket-reconnect'
import {
  extractLivePriceUpdates,
  isSnapshotMessage,
  keepWithinLiveWindow,
  LIVE_DATA_RETENTION_MS,
  LIVE_WS_USE_ONLY_LAST_UPDATE_PER_MESSAGE,
  MAX_POINTS,
  normalizeLiveChartPrice,
  SERIES_KEY,
  writePersistedLivePrice,
} from '../_utils/eventLiveSeriesChartUtils'

const PRICE_REFERENCE_POLL_INTERVAL_MS = 5000

interface LiveSeriesPriceReferenceSnapshot {
  latest_price: number | null
  latest_source_timestamp_ms: number | null
  latest_window_end_ms: number | null
}

interface UseLiveSeriesWebSocketOptions {
  activeWindowMinutes: number
  eventEndTimestamp: number | null
  topic: string
  eventType: string
  seriesSlug: string
  startTimestamp: number | null
  subscriptionSymbol: string
  isLiveView: boolean
  setBaselinePrice: React.Dispatch<React.SetStateAction<number | null>>
}

export function useLiveSeriesWebSocket({
  activeWindowMinutes,
  eventEndTimestamp,
  topic,
  eventType,
  seriesSlug,
  startTimestamp,
  subscriptionSymbol,
  isLiveView,
  setBaselinePrice,
}: UseLiveSeriesWebSocketOptions) {
  const wsUrl = process.env.WS_LIVE_DATA_URL
  const [data, setData] = useState<DataPoint[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(
    () => ((wsUrl || seriesSlug.trim()) ? 'connecting' : 'offline'),
  )

  useEffect(function connectLiveSeriesWebSocket() {
    if (!isLiveView) {
      return
    }

    const normalizedSeriesSlug = seriesSlug.trim()
    const canPollPriceReference = Boolean(
      normalizedSeriesSlug
      && eventEndTimestamp
      && eventEndTimestamp > 0,
    )
    const shouldUseWebSocket = Boolean(wsUrl)

    if (!shouldUseWebSocket && !canPollPriceReference) {
      return
    }

    const resolvedWsUrl = wsUrl
    let isActive = true
    let ws: WebSocket | null = null
    let fallbackPollTimeout: number | null = null
    let fallbackAbortController: AbortController | null = null
    let lastFallbackSignature = ''
    let lastSuccessfulDataAt = 0

    function clearFallbackPoll() {
      if (fallbackPollTimeout != null) {
        window.clearTimeout(fallbackPollTimeout)
        fallbackPollTimeout = null
      }
      fallbackAbortController?.abort()
      fallbackAbortController = null
    }

    function markDataAsLive() {
      lastSuccessfulDataAt = Date.now()
      setStatus('live')
    }

    function hasRecentLiveData() {
      return Date.now() - lastSuccessfulDataAt < PRICE_REFERENCE_POLL_INTERVAL_MS * 2
    }

    function buildSubscriptionPayload(action: 'subscribe' | 'unsubscribe') {
      const filters = JSON.stringify({
        symbol: subscriptionSymbol,
      })

      return JSON.stringify({
        action,
        subscriptions: [
          {
            topic,
            type: eventType,
            filters,
          },
        ],
      })
    }

    function applyUpdates(
      updates: Array<{ price: number, timestamp: number, symbol: string | null }>,
      messageIsSnapshot = false,
    ) {
      const normalizedUpdates = updates
        .map((update) => {
          const normalizedPrice = normalizeLiveChartPrice(update.price, topic)
          if (normalizedPrice == null) {
            return null
          }

          return {
            ...update,
            price: normalizedPrice,
          }
        })
        .filter((update): update is { price: number, timestamp: number, symbol: string | null } => update !== null)

      const messageHasBatchUpdates = normalizedUpdates.length > 1
      const updatesForRender = LIVE_WS_USE_ONLY_LAST_UPDATE_PER_MESSAGE
        ? (messageIsSnapshot || messageHasBatchUpdates ? normalizedUpdates : normalizedUpdates.slice(-1))
        : normalizedUpdates

      if (!updatesForRender.length) {
        return false
      }

      markDataAsLive()
      const latest = updatesForRender.at(-1)
      if (latest) {
        writePersistedLivePrice(topic, subscriptionSymbol, latest.price, latest.timestamp)
      }

      setData((prev) => {
        const arrivalTimestamp = Date.now()
        const cutoff = arrivalTimestamp - LIVE_DATA_RETENTION_MS

        if (messageIsSnapshot && updatesForRender.length > 1) {
          let lastSnapshotTimestamp: number | null = null
          const snapshotPoints: DataPoint[] = []

          for (const update of updatesForRender) {
            let pointTimestamp = update.timestamp
            if (!Number.isFinite(pointTimestamp)) {
              continue
            }

            pointTimestamp = Math.max(cutoff + 1, Math.min(pointTimestamp, arrivalTimestamp))
            if (lastSnapshotTimestamp !== null && pointTimestamp <= lastSnapshotTimestamp) {
              pointTimestamp = lastSnapshotTimestamp + 1
            }

            snapshotPoints.push({
              date: new Date(pointTimestamp),
              [SERIES_KEY]: update.price,
            })
            lastSnapshotTimestamp = pointTimestamp
          }

          if (snapshotPoints.length > 0) {
            return snapshotPoints.slice(-MAX_POINTS)
          }
        }

        let next = keepWithinLiveWindow(prev, cutoff)
        const lastPoint = next.length ? next.at(-1) : null
        let lastTimestamp = lastPoint ? lastPoint.date.getTime() : null

        for (const update of updatesForRender) {
          let pointTimestamp = Math.max(update.timestamp, arrivalTimestamp)

          if (lastTimestamp !== null && pointTimestamp <= lastTimestamp) {
            pointTimestamp = lastTimestamp + 1
          }

          const nextPoint: DataPoint = {
            date: new Date(pointTimestamp),
            [SERIES_KEY]: update.price,
          }

          next = [...next, nextPoint].slice(-MAX_POINTS)
          lastTimestamp = pointTimestamp
        }

        return next
      })

      setBaselinePrice(current => current ?? updatesForRender[0]?.price ?? null)
      return true
    }

    function handleOpen() {
      if (!ws) {
        return
      }
      if (!hasRecentLiveData()) {
        setStatus('connecting')
      }
      ws.send(buildSubscriptionPayload('subscribe'))
    }

    function handleMessage(eventMessage: MessageEvent<string>) {
      if (!isActive) {
        return
      }

      let payload: any
      try {
        payload = JSON.parse(eventMessage.data)
      }
      catch {
        return
      }

      const updates = extractLivePriceUpdates(payload, topic, subscriptionSymbol, Date.now())
      applyUpdates(updates, isSnapshotMessage(payload))
    }

    function handleError() {
      if (isActive && !hasRecentLiveData()) {
        setStatus('offline')
      }
    }

    let reconnectController: ReturnType<typeof createWebSocketReconnectController> | null = null

    function clearReconnect() {
      reconnectController?.clearReconnect()
    }

    function handleVisibilityChange() {
      reconnectController?.handleVisibilityChange()
      if (!document.hidden) {
        scheduleFallbackPoll(0)
      }
    }

    function scheduleReconnect() {
      reconnectController?.scheduleReconnect()
    }

    function handleClose() {
      if (!isActive) {
        return
      }
      if (!hasRecentLiveData()) {
        setStatus('offline')
      }
      scheduleReconnect()
    }

    function connect() {
      if (!isActive || ws || document.hidden || !resolvedWsUrl) {
        return
      }
      ws = new WebSocket(resolvedWsUrl)
      ws.addEventListener('open', handleOpen)
      ws.addEventListener('message', handleMessage)
      ws.addEventListener('error', handleError)
      ws.addEventListener('close', handleClose)
    }

    function scheduleFallbackPoll(delayMs = PRICE_REFERENCE_POLL_INTERVAL_MS) {
      clearFallbackPoll()
      if (!isActive || !canPollPriceReference) {
        return
      }
      fallbackPollTimeout = window.setTimeout(() => {
        void pollPriceReference()
      }, delayMs)
    }

    async function pollPriceReference() {
      if (!isActive || !canPollPriceReference || document.hidden || !eventEndTimestamp) {
        scheduleFallbackPoll()
        return
      }

      fallbackAbortController = new AbortController()

      try {
        const query = new URLSearchParams({
          seriesSlug: normalizedSeriesSlug,
          eventEndMs: String(eventEndTimestamp),
          activeWindowMinutes: String(activeWindowMinutes),
        })

        if (
          startTimestamp != null
          && startTimestamp > 0
          && startTimestamp < eventEndTimestamp
        ) {
          query.set('eventStartMs', String(startTimestamp))
        }

        const response = await fetch(`/api/price-reference/live-series?${query.toString()}`, {
          cache: 'no-store',
          signal: fallbackAbortController.signal,
        })

        if (!response.ok) {
          return
        }

        const payload = await response.json() as LiveSeriesPriceReferenceSnapshot
        if (!isActive) {
          return
        }

        const normalizedPrice = normalizeLiveChartPrice(
          Number(payload.latest_price ?? Number.NaN),
          topic,
        )
        if (normalizedPrice == null) {
          return
        }

        const rawTimestamp = Number(
          payload.latest_source_timestamp_ms
          ?? payload.latest_window_end_ms
          ?? Date.now(),
        )
        const normalizedTimestamp = Number.isFinite(rawTimestamp) && rawTimestamp > 0
          ? rawTimestamp
          : Date.now()
        const signature = `${normalizedTimestamp}:${normalizedPrice}`

        if (signature === lastFallbackSignature) {
          markDataAsLive()
          return
        }

        lastFallbackSignature = signature
        applyUpdates([{
          price: normalizedPrice,
          timestamp: normalizedTimestamp,
          symbol: subscriptionSymbol,
        }])
      }
      catch {
      }
      finally {
        fallbackAbortController = null
        scheduleFallbackPoll()
      }
    }

    reconnectController = createWebSocketReconnectController({
      connect,
      getWebSocket: () => ws,
      isActive: () => isActive,
      resetWebSocket: () => {
        ws = null
      },
    })

    if (shouldUseWebSocket) {
      connect()
    }
    scheduleFallbackPoll(0)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return function cleanupLiveSeriesWebSocket() {
      isActive = false
      setStatus('offline')
      clearReconnect()
      clearFallbackPoll()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      const socket = ws
      if (socket) {
        socket.removeEventListener('open', handleOpen)
        socket.removeEventListener('message', handleMessage)
        socket.removeEventListener('error', handleError)
        socket.removeEventListener('close', handleClose)
        closeWebSocketWhenReady(socket, (currentSocket) => {
          currentSocket.send(buildSubscriptionPayload('unsubscribe'))
          currentSocket.close()
        })
      }
    }
  }, [
    activeWindowMinutes,
    eventEndTimestamp,
    eventType,
    isLiveView,
    seriesSlug,
    setBaselinePrice,
    startTimestamp,
    subscriptionSymbol,
    topic,
    wsUrl,
  ])

  return { data, status }
}

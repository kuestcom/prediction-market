import type { DataPoint } from '@/types/PredictionChartTypes'
import { useEffect, useState } from 'react'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { closeWebSocketWhenReady, createWebSocketReconnectController } from '@/lib/websocket-reconnect'
import {
  appendLivePriceTransition,
  extractLivePriceUpdates,
  isSnapshotMessage,
  keepWithinLiveWindow,
  LIVE_DATA_RETENTION_MS,
  MAX_POINTS,
  normalizeLiveChartPrice,
  resolveLivePriceTransitionDuration,
  SERIES_KEY,
  writePersistedLivePrice,
} from '../_utils/eventLiveSeriesChartUtils'

interface UseLiveSeriesWebSocketOptions {
  topic: string
  eventType: string
  eventEndTimestamp: number | null
  subscriptionSymbol: string
  isLiveView: boolean
}

export function useLiveSeriesWebSocket({
  topic,
  eventType,
  eventEndTimestamp,
  subscriptionSymbol,
  isLiveView,
}: UseLiveSeriesWebSocketOptions) {
  const { wsLiveDataUrl } = usePublicRuntimeConfig()
  const wsUrl = wsLiveDataUrl
  const [data, setData] = useState<DataPoint[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(
    () => (wsUrl ? 'connecting' : 'offline'),
  )

  useEffect(function connectLiveSeriesWebSocket() {
    if (!isLiveView) {
      return
    }

    if (!wsUrl) {
      return
    }
    // Intentionally keep WS active regardless of event close to preserve always-live behavior.
    const resolvedWsUrl = wsUrl

    let isActive = true
    let ws: WebSocket | null = null
    let previousPriceMessageTimestamp: number | null = null

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

    function handleOpen() {
      if (!ws) {
        return
      }
      setStatus('connecting')
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

      const arrivalTimestamp = Date.now()
      const updates = extractLivePriceUpdates(payload, topic, subscriptionSymbol, arrivalTimestamp)
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
        .filter(update => eventEndTimestamp == null || update.timestamp <= eventEndTimestamp)

      const messageIsSnapshot = isSnapshotMessage(payload)
      const wsUpdatesForRender = messageIsSnapshot
        ? normalizedUpdates
        : normalizedUpdates.slice(-1)

      if (!wsUpdatesForRender.length) {
        return
      }

      const cadenceTransitionDurationMs = resolveLivePriceTransitionDuration(
        previousPriceMessageTimestamp,
        arrivalTimestamp,
      )
      const transitionStartTimestamp = eventEndTimestamp == null
        ? arrivalTimestamp
        : Math.min(arrivalTimestamp, eventEndTimestamp)
      const transitionDurationMs = eventEndTimestamp == null
        ? cadenceTransitionDurationMs
        : Math.min(
            cadenceTransitionDurationMs,
            Math.max(0, eventEndTimestamp - transitionStartTimestamp),
          )
      previousPriceMessageTimestamp = arrivalTimestamp

      setStatus('live')
      const latest = wsUpdatesForRender.at(-1)
      if (latest) {
        writePersistedLivePrice(topic, subscriptionSymbol, latest.price, latest.timestamp)
      }

      setData((prev) => {
        const cutoff = arrivalTimestamp - LIVE_DATA_RETENTION_MS

        if (messageIsSnapshot) {
          let lastSnapshotTimestamp: number | null = null
          const snapshotPoints: DataPoint[] = []

          for (const update of wsUpdatesForRender) {
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

          if (snapshotPoints.length > 1 || (snapshotPoints.length === 1 && prev.length === 0)) {
            return snapshotPoints.slice(-MAX_POINTS)
          }
        }

        const latestUpdate = wsUpdatesForRender.at(-1)
        if (!latestUpdate) {
          return prev
        }

        const retainedPoints = keepWithinLiveWindow(prev, cutoff)

        // Treat live values as targets. Future samples are revealed by the existing
        // 30 FPS chart clock, and a new target retakes the current visual price.
        return appendLivePriceTransition(
          retainedPoints,
          latestUpdate.price,
          transitionStartTimestamp,
          transitionDurationMs,
        )
      })
    }

    function handleError() {
      if (isActive) {
        setStatus('offline')
      }
    }

    let reconnectController: ReturnType<typeof createWebSocketReconnectController> | null = null

    function clearReconnect() {
      reconnectController?.clearReconnect()
    }

    function handleVisibilityChange() {
      reconnectController?.handleVisibilityChange()
    }

    function scheduleReconnect() {
      reconnectController?.scheduleReconnect()
    }

    function handleClose() {
      if (!isActive) {
        return
      }
      setStatus('offline')
      scheduleReconnect()
    }

    function connect() {
      if (!isActive || ws || document.hidden) {
        return
      }
      const socket = new WebSocket(resolvedWsUrl)
      socket.onopen = handleOpen
      socket.onmessage = handleMessage
      socket.onerror = handleError
      socket.onclose = handleClose
      ws = socket
    }

    reconnectController = createWebSocketReconnectController({
      connect,
      getWebSocket: () => ws,
      isActive: () => isActive,
      reconnectOnVisible: true,
      resetWebSocket: () => {
        ws = null
      },
    })

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return function cleanupLiveSeriesWebSocket() {
      isActive = false
      setStatus('offline')
      clearReconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      const socket = ws
      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        closeWebSocketWhenReady(socket, (currentSocket) => {
          currentSocket.send(buildSubscriptionPayload('unsubscribe'))
          currentSocket.close()
        })
      }
    }
  }, [eventEndTimestamp, eventType, topic, isLiveView, wsUrl, subscriptionSymbol])

  return { data, status }
}

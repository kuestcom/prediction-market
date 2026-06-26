import type { DataPoint } from '@/types/PredictionChartTypes'
import { useEffect, useState } from 'react'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
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

interface UseLiveSeriesWebSocketOptions {
  topic: string
  eventType: string
  subscriptionSymbol: string
  isLiveView: boolean
  setBaselinePrice: React.Dispatch<React.SetStateAction<number | null>>
}

export function useLiveSeriesWebSocket({
  topic,
  eventType,
  subscriptionSymbol,
  isLiveView,
  setBaselinePrice,
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

      const updates = extractLivePriceUpdates(payload, topic, subscriptionSymbol, Date.now())
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

      const messageIsSnapshot = isSnapshotMessage(payload)
      const messageHasBatchUpdates = normalizedUpdates.length > 1
      const wsUpdatesForRender = LIVE_WS_USE_ONLY_LAST_UPDATE_PER_MESSAGE
        ? (messageIsSnapshot || messageHasBatchUpdates ? normalizedUpdates : normalizedUpdates.slice(-1))
        : normalizedUpdates

      if (!wsUpdatesForRender.length) {
        return
      }

      setStatus('live')
      const latest = wsUpdatesForRender.at(-1)
      if (latest) {
        writePersistedLivePrice(topic, subscriptionSymbol, latest.price, latest.timestamp)
      }

      setData((prev) => {
        const arrivalTimestamp = Date.now()
        const cutoff = arrivalTimestamp - LIVE_DATA_RETENTION_MS

        if (messageIsSnapshot && wsUpdatesForRender.length > 1) {
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

          if (snapshotPoints.length > 0) {
            return snapshotPoints.slice(-MAX_POINTS)
          }
        }

        let next = keepWithinLiveWindow(prev, cutoff)
        const lastPoint = next.length ? next.at(-1) : null
        let lastTimestamp = lastPoint ? lastPoint.date.getTime() : null

        for (const update of wsUpdatesForRender) {
          // Anchor incoming points to arrival time to avoid delayed-source timestamp jumps.
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

      setBaselinePrice(current => current ?? wsUpdatesForRender[0]?.price ?? null)
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
  }, [eventType, topic, isLiveView, wsUrl, subscriptionSymbol, setBaselinePrice])

  return { data, status }
}

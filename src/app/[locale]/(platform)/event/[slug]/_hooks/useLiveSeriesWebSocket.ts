import { useEffect, useRef, useState } from 'react'

import type { DataPoint } from '@/types/PredictionChartTypes'

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

const LIVE_DATA_HEARTBEAT_INTERVAL_MS = 5_000

export function useLiveSeriesWebSocket({
  topic,
  eventType,
  eventEndTimestamp,
  subscriptionSymbol,
  isLiveView,
}: UseLiveSeriesWebSocketOptions) {
  const { wsLiveDataUrl } = usePublicRuntimeConfig()
  const wsUrl = wsLiveDataUrl
  const eventEndTimestampRef = useRef(eventEndTimestamp)
  eventEndTimestampRef.current = eventEndTimestamp
  const [data, setData] = useState<DataPoint[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(() => (wsUrl ? 'connecting' : 'offline'))

  useEffect(
    function connectLiveSeriesWebSocket() {
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
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null
      let previousPriceMessageTimestamp: number | null = null

      function stopHeartbeat() {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
          heartbeatInterval = null
        }
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

      function handleOpen(socket: WebSocket) {
        if (ws !== socket) {
          return
        }
        setStatus('connecting')
        socket.send(buildSubscriptionPayload('subscribe'))
        stopHeartbeat()
        heartbeatInterval = setInterval(() => {
          if (ws === socket && socket.readyState === WebSocket.OPEN) {
            socket.send('PING')
          }
        }, LIVE_DATA_HEARTBEAT_INTERVAL_MS)
      }

      function handleMessage(socket: WebSocket, eventMessage: MessageEvent<string>) {
        if (!isActive || ws !== socket) {
          return
        }

        let payload: any
        try {
          payload = JSON.parse(eventMessage.data)
        } catch {
          return
        }

        const arrivalTimestamp = Date.now()
        const activeEventEndTimestamp = eventEndTimestampRef.current
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
          .filter((update): update is { price: number; timestamp: number; symbol: string | null } => update !== null)
          .filter((update) => activeEventEndTimestamp == null || update.timestamp <= activeEventEndTimestamp)

        const messageIsSnapshot = isSnapshotMessage(payload)
        const wsUpdatesForRender = messageIsSnapshot ? normalizedUpdates : normalizedUpdates.slice(-1)

        if (!wsUpdatesForRender.length) {
          return
        }

        const cadenceTransitionDurationMs = resolveLivePriceTransitionDuration(
          previousPriceMessageTimestamp,
          arrivalTimestamp,
        )
        const transitionStartTimestamp =
          activeEventEndTimestamp == null ? arrivalTimestamp : Math.min(arrivalTimestamp, activeEventEndTimestamp)
        const transitionDurationMs =
          activeEventEndTimestamp == null
            ? cadenceTransitionDurationMs
            : Math.min(cadenceTransitionDurationMs, Math.max(0, activeEventEndTimestamp - transitionStartTimestamp))
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
        if (!document.hidden) {
          previousPriceMessageTimestamp = null
          setStatus('connecting')
        }
        reconnectController?.handleVisibilityChange()
      }

      function scheduleReconnect() {
        reconnectController?.scheduleReconnect()
      }

      function handleClose(socket: WebSocket) {
        if (ws !== socket) {
          return
        }
        stopHeartbeat()
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
        socket.onopen = () => handleOpen(socket)
        socket.onmessage = (eventMessage) => handleMessage(socket, eventMessage)
        socket.onerror = handleError
        socket.onclose = () => handleClose(socket)
        ws = socket
      }

      reconnectController = createWebSocketReconnectController({
        connect,
        getWebSocket: () => ws,
        isActive: () => isActive,
        reconnectOnVisible: true,
        resetWebSocket: () => {
          stopHeartbeat()
          ws = null
        },
      })

      // oxlint-disable-next-line react-you-might-not-need-an-effect/no-external-store-subscription -- A WebSocket is an external system, not a store; this effect owns its lifecycle.
      connect()
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return function cleanupLiveSeriesWebSocket() {
        isActive = false
        setStatus('offline')
        stopHeartbeat()
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
    },
    [eventType, topic, isLiveView, wsUrl, subscriptionSymbol],
  )

  return { data, status }
}

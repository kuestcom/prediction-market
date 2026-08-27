'use client'

import { useEffect, useRef } from 'react'

import type { DataApiActivity } from '@/lib/data-api/user'

import {
  closeWebSocketWhenReady,
  createWebSocketHeartbeatController,
  createWebSocketReconnectController,
  probeWebSocketWithPong,
} from '@/lib/websocket-reconnect'

interface LiveActivityMessage {
  payload?: DataApiActivity | DataApiActivity[]
  topic?: string
  type?: string
}

interface UseEventActivityWebSocketOptions {
  eventSlug: string
  onActivities: (activities: DataApiActivity[]) => void
  wsUrl: string | undefined
}

function buildSubscriptionPayload(action: 'subscribe' | 'unsubscribe', eventSlug: string) {
  return JSON.stringify({
    action,
    subscriptions: [
      {
        topic: 'activity',
        type: 'orders_matched',
        filters: {
          event_slug: eventSlug,
        },
      },
    ],
  })
}

export function useEventActivityWebSocket({ eventSlug, onActivities, wsUrl }: UseEventActivityWebSocketOptions) {
  const onActivitiesRef = useRef(onActivities)

  useEffect(() => {
    onActivitiesRef.current = onActivities
  }, [onActivities])

  useEffect(
    function subscribeToEventActivity() {
      const normalizedEventSlug = eventSlug.trim().toLowerCase()
      if (!wsUrl || !normalizedEventSlug) {
        return
      }

      const activeWsUrl = wsUrl
      let isActive = true
      let ws: WebSocket | null = null

      function handleOpen(socket: WebSocket) {
        if (socket !== ws) {
          return
        }

        reconnectController?.markConnected()
        heartbeatController?.markOpen(socket)
        socket.send(buildSubscriptionPayload('subscribe', normalizedEventSlug))
      }

      function handleMessage(socket: WebSocket, eventMessage: MessageEvent<string>) {
        if (!isActive || socket !== ws) {
          return
        }

        heartbeatController?.markActivity(socket)

        let message: LiveActivityMessage
        try {
          message = JSON.parse(eventMessage.data) as LiveActivityMessage
        } catch {
          return
        }

        if (message.topic !== 'activity' || message.type !== 'orders_matched' || !message.payload) {
          return
        }

        const activities = Array.isArray(message.payload) ? message.payload : [message.payload]
        if (activities.length > 0) {
          onActivitiesRef.current(activities)
        }
      }

      let reconnectController: ReturnType<typeof createWebSocketReconnectController> | null = null
      let heartbeatController: ReturnType<typeof createWebSocketHeartbeatController> | null = null

      function clearReconnect() {
        reconnectController?.clearReconnect()
      }

      function handleVisibilityChange() {
        reconnectController?.handleVisibilityChange()
      }

      function scheduleReconnect() {
        reconnectController?.scheduleReconnect()
      }

      function handleClose(socket: WebSocket) {
        if (socket !== ws) {
          return
        }

        heartbeatController?.clear()
        if (!isActive) {
          return
        }

        ws = null
        scheduleReconnect()
      }

      function connect() {
        if (!isActive || ws || document.hidden) {
          return
        }

        const socket = new WebSocket(activeWsUrl)
        socket.onopen = () => handleOpen(socket)
        socket.onmessage = (eventMessage) => handleMessage(socket, eventMessage)
        socket.onclose = () => handleClose(socket)
        ws = socket
        heartbeatController?.markConnecting(socket)
      }

      reconnectController = createWebSocketReconnectController({
        connect,
        getWebSocket: () => ws,
        isActive: () => isActive,
        probeWebSocket: probeWebSocketWithPong,
        resetWebSocket: () => {
          heartbeatController?.clear()
          ws = null
        },
      })
      heartbeatController = createWebSocketHeartbeatController({
        getWebSocket: () => ws,
        isActive: () => isActive,
        onConnectionLost: (socket) => {
          ws = null
          closeWebSocketWhenReady(socket)
          scheduleReconnect()
        },
      })

      connect()
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return function unsubscribeFromEventActivity() {
        isActive = false
        clearReconnect()
        heartbeatController.clear()
        document.removeEventListener('visibilitychange', handleVisibilityChange)

        const socket = ws
        if (socket) {
          socket.onopen = null
          socket.onmessage = null
          socket.onerror = null
          socket.onclose = null
          closeWebSocketWhenReady(socket, (currentSocket) => {
            currentSocket.send(buildSubscriptionPayload('unsubscribe', normalizedEventSlug))
            currentSocket.close()
          })
        }
      }
    },
    [eventSlug, wsUrl],
  )
}

const DEFAULT_RECONNECT_DELAY_MS = 1500

interface CreateWebSocketReconnectControllerOptions {
  connect: () => void
  delayMs?: number
  disconnectWebSocket?: (ws: WebSocket) => void
  getWebSocket: () => WebSocket | null
  isActive: () => boolean
  reconnectOnVisible?: boolean
  resetWebSocket: () => void
}

export function createWebSocketReconnectController({
  connect,
  delayMs = DEFAULT_RECONNECT_DELAY_MS,
  disconnectWebSocket,
  getWebSocket,
  isActive,
  reconnectOnVisible = false,
  resetWebSocket,
}: CreateWebSocketReconnectControllerOptions) {
  let reconnectTimeout: number | null = null

  function isClosedOrClosing(ws: WebSocket | null) {
    return !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING
  }

  function shouldReconnect() {
    return isClosedOrClosing(getWebSocket())
  }

  function clearReconnect() {
    if (reconnectTimeout != null) {
      window.clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  function disconnectCurrentWebSocket() {
    const ws = getWebSocket()
    if (!ws) {
      return
    }

    resetWebSocket()
    if (disconnectWebSocket) {
      disconnectWebSocket(ws)
      return
    }
    closeWebSocketWhenReady(ws)
  }

  function reconnectIfNeeded() {
    if (!isActive() || !shouldReconnect()) {
      return
    }

    resetWebSocket()
    connect()
  }

  function scheduleReconnect() {
    clearReconnect()
    reconnectTimeout = window.setTimeout(() => {
      reconnectIfNeeded()
    }, delayMs)
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      if (!isActive()) {
        return
      }
      if (reconnectOnVisible) {
        clearReconnect()
        disconnectCurrentWebSocket()
        connect()
        return
      }
      reconnectIfNeeded()
    }
  }

  return {
    clearReconnect,
    handleVisibilityChange,
    scheduleReconnect,
  }
}

export function closeWebSocketWhenReady(
  ws: WebSocket,
  close: (socket: WebSocket) => void = socket => socket.close(),
) {
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.close()
    return
  }

  if (ws.readyState !== WebSocket.OPEN) {
    return
  }

  close(ws)
}

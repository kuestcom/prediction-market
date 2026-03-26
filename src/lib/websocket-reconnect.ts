const DEFAULT_RECONNECT_DELAY_MS = 1500

interface CreateWebSocketReconnectControllerOptions {
  connect: () => void
  delayMs?: number
  getWebSocket: () => WebSocket | null
  isActive: () => boolean
  resetWebSocket: () => void
}

export function createWebSocketReconnectController({
  connect,
  delayMs = DEFAULT_RECONNECT_DELAY_MS,
  getWebSocket,
  isActive,
  resetWebSocket,
}: CreateWebSocketReconnectControllerOptions) {
  let reconnectTimeout: number | null = null

  function shouldReconnect() {
    const ws = getWebSocket()
    return !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING
  }

  function clearReconnect() {
    if (reconnectTimeout != null) {
      window.clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
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
      reconnectIfNeeded()
    }
  }

  return {
    clearReconnect,
    handleVisibilityChange,
    scheduleReconnect,
  }
}

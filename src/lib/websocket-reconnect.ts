const DEFAULT_RECONNECT_DELAY_MS = 1500
const MAX_RECONNECT_DELAY_MS = 30_000
const RECONNECT_JITTER_RATIO = 0.2
const CONNECTION_STABLE_MS = 30_000

interface CreateWebSocketReconnectControllerOptions {
  connect: () => void
  delayMs?: number
  getWebSocket: () => WebSocket | null
  isActive: () => boolean
  probeWebSocket?: (ws: WebSocket) => Promise<boolean>
  resetWebSocket: () => void
}

export function createWebSocketReconnectController({
  connect,
  delayMs = DEFAULT_RECONNECT_DELAY_MS,
  getWebSocket,
  isActive,
  probeWebSocket,
  resetWebSocket,
}: CreateWebSocketReconnectControllerOptions) {
  let reconnectTimeout: number | null = null
  let stableTimeout: number | null = null
  let reconnectAttempt = 0
  let probeSocket: WebSocket | null = null
  let probeGeneration = 0

  function isClosedOrClosing(ws: WebSocket | null) {
    return !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING
  }

  function shouldReconnect() {
    return isClosedOrClosing(getWebSocket())
  }

  function clearReconnectTimer() {
    if (reconnectTimeout != null) {
      window.clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  function clearStableTimer() {
    if (stableTimeout != null) {
      window.clearTimeout(stableTimeout)
      stableTimeout = null
    }
  }

  function clearReconnect() {
    probeGeneration += 1
    probeSocket = null
    clearReconnectTimer()
    clearStableTimer()
  }

  function markConnected() {
    clearReconnectTimer()
    clearStableTimer()
    stableTimeout = window.setTimeout(() => {
      stableTimeout = null
      reconnectAttempt = 0
    }, CONNECTION_STABLE_MS)
  }

  function reconnectIfNeeded() {
    if (!isActive() || !shouldReconnect()) {
      return
    }

    resetWebSocket()
    connect()
  }

  function scheduleReconnect() {
    if (reconnectTimeout != null) {
      return
    }
    clearStableTimer()
    const baseDelay = Math.min(MAX_RECONNECT_DELAY_MS, Math.max(1, delayMs) * 2 ** reconnectAttempt)
    reconnectAttempt += 1
    reconnectTimeout = window.setTimeout(
      () => {
        reconnectTimeout = null
        reconnectIfNeeded()
      },
      baseDelay + randomJitter(Math.ceil(baseDelay * RECONNECT_JITTER_RATIO)),
    )
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      if (!isActive()) {
        return
      }
      clearReconnectTimer()
      const ws = getWebSocket()
      if (isClosedOrClosing(ws)) {
        reconnectIfNeeded()
        return
      }
      if (!probeWebSocket || !ws || ws.readyState !== WebSocket.OPEN || probeSocket === ws) {
        return
      }

      const generation = ++probeGeneration
      probeSocket = ws
      void probeWebSocket(ws)
        .then((healthy) => finishVisibilityProbe(ws, generation, healthy))
        .catch(() => finishVisibilityProbe(ws, generation, false))
    }
  }

  function finishVisibilityProbe(ws: WebSocket, generation: number, healthy: boolean) {
    if (generation !== probeGeneration || probeSocket !== ws) {
      return
    }
    probeSocket = null
    if (!isActive() || getWebSocket() !== ws) {
      return
    }
    if (healthy) {
      markConnected()
      return
    }

    resetWebSocket()
    closeWebSocketWhenReady(ws)
    scheduleReconnect()
  }

  return {
    clearReconnect,
    handleVisibilityChange,
    markConnected,
    scheduleReconnect,
  }
}

export function probeWebSocketWithPong(ws: WebSocket, timeoutMs = 5_000): Promise<boolean> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    let settled = false
    let timeout: number | null = null

    function finish(healthy: boolean) {
      if (settled) {
        return
      }
      settled = true
      if (timeout != null) {
        window.clearTimeout(timeout)
      }
      ws.removeEventListener('message', handleMessage)
      ws.removeEventListener('close', handleClose)
      ws.removeEventListener('error', handleError)
      resolve(healthy)
    }

    function handleMessage(event: MessageEvent) {
      if (event.data === 'PONG') {
        finish(true)
      }
    }

    function handleClose() {
      finish(false)
    }

    function handleError() {
      finish(false)
    }

    ws.addEventListener('message', handleMessage)
    ws.addEventListener('close', handleClose)
    ws.addEventListener('error', handleError)
    timeout = window.setTimeout(() => finish(false), Math.max(1, timeoutMs))
    try {
      ws.send('PING')
    } catch {
      finish(false)
    }
  })
}

function randomJitter(max: number): number {
  if (max <= 0 || typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    return 0
  }
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return Math.floor((values[0] / 0xffffffff) * (max + 1))
}

export function closeWebSocketWhenReady(
  ws: WebSocket,
  close: (socket: WebSocket) => void = (socket) => socket.close(),
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

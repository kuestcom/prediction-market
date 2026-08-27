import {
  closeWebSocketWhenReady,
  createWebSocketHeartbeatController,
  createWebSocketReconnectController,
  probeWebSocketWithPong,
} from '@/lib/websocket-reconnect'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function createWebSocketStub(readyState: number) {
  const close = vi.fn()
  const addEventListener = vi.fn()
  return {
    socket: {
      readyState,
      close,
      addEventListener,
    } as unknown as WebSocket,
    close,
    addEventListener,
  }
}

function createProbeWebSocket() {
  const listeners = new Map<string, Set<(event: Event) => void>>()
  const send = vi.fn()
  const close = vi.fn()
  const socket = {
    readyState: WebSocket.OPEN,
    send,
    close,
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const eventListeners = listeners.get(type) ?? new Set<(event: Event) => void>()
      eventListeners.add(listener)
      listeners.set(type, eventListeners)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    }),
  } as unknown as WebSocket

  return {
    socket,
    send,
    close,
    emit(type: string, event: Event) {
      listeners.get(type)?.forEach((listener) => listener(event))
    },
  }
}

describe('closeWebSocketWhenReady', () => {
  it('closes connecting sockets immediately without waiting for open', () => {
    const { socket, close, addEventListener } = createWebSocketStub(WebSocket.CONNECTING)
    const closeOpenSocket = vi.fn()

    closeWebSocketWhenReady(socket, closeOpenSocket)

    expect(close).toHaveBeenCalledTimes(1)
    expect(addEventListener).not.toHaveBeenCalled()
    expect(closeOpenSocket).not.toHaveBeenCalled()
  })

  it('runs the graceful close callback for open sockets', () => {
    const { socket, close } = createWebSocketStub(WebSocket.OPEN)
    const closeOpenSocket = vi.fn()

    closeWebSocketWhenReady(socket, closeOpenSocket)

    expect(closeOpenSocket).toHaveBeenCalledWith(socket)
    expect(close).not.toHaveBeenCalled()
  })

  it('ignores sockets that are already closing or closed', () => {
    const { socket: closingSocket, close: closingClose } = createWebSocketStub(WebSocket.CLOSING)
    const { socket: closedSocket, close: closedClose } = createWebSocketStub(WebSocket.CLOSED)
    const closeOpenSocket = vi.fn()

    closeWebSocketWhenReady(closingSocket, closeOpenSocket)
    closeWebSocketWhenReady(closedSocket, closeOpenSocket)

    expect(closingClose).not.toHaveBeenCalled()
    expect(closedClose).not.toHaveBeenCalled()
    expect(closeOpenSocket).not.toHaveBeenCalled()
  })
})

describe('createWebSocketHeartbeatController', () => {
  it('abandons a socket whose opening handshake stalls', () => {
    vi.useFakeTimers()
    const socket = {
      readyState: WebSocket.CONNECTING,
      send: vi.fn(),
    } as unknown as WebSocket
    const onConnectionLost = vi.fn()
    const controller = createWebSocketHeartbeatController({
      getWebSocket: () => socket,
      isActive: () => true,
      onConnectionLost,
    })

    controller.markConnecting(socket)
    vi.advanceTimersByTime(9_999)
    expect(onConnectionLost).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onConnectionLost).toHaveBeenCalledOnce()
    expect(onConnectionLost).toHaveBeenCalledWith(socket)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses only explicitly marked activity to refresh staleness', () => {
    vi.useFakeTimers()
    const send = vi.fn()
    const socket = {
      readyState: WebSocket.OPEN,
      send,
    } as unknown as WebSocket
    const onConnectionLost = vi.fn()
    const controller = createWebSocketHeartbeatController({
      getWebSocket: () => socket,
      isActive: () => true,
      onConnectionLost,
    })

    controller.markOpen(socket)
    vi.advanceTimersByTime(25_000)
    expect(send).toHaveBeenLastCalledWith('PING')

    controller.markActivity(socket)
    vi.advanceTimersByTime(50_000)
    expect(onConnectionLost).not.toHaveBeenCalled()

    vi.advanceTimersByTime(25_000)
    expect(onConnectionLost).toHaveBeenCalledWith(socket)
  })
})

describe('createWebSocketReconnectController', () => {
  function mockDocumentHidden(hidden: boolean) {
    return vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden)
  }

  it('does not reconnect an open socket on tab visibility by default', () => {
    const hiddenSpy = mockDocumentHidden(false)
    let ws: WebSocket | null = createWebSocketStub(WebSocket.OPEN).socket
    const connect = vi.fn()
    const resetWebSocket = vi.fn(() => {
      ws = null
    })

    const controller = createWebSocketReconnectController({
      connect,
      getWebSocket: () => ws,
      isActive: () => true,
      resetWebSocket,
    })

    controller.handleVisibilityChange()

    expect(connect).not.toHaveBeenCalled()
    expect(resetWebSocket).not.toHaveBeenCalled()
    hiddenSpy.mockRestore()
  })

  it('does not force a fresh socket when an existing stream becomes visible again', () => {
    const hiddenSpy = mockDocumentHidden(false)
    const staleSocket = createWebSocketStub(WebSocket.OPEN).socket
    let ws: WebSocket | null = staleSocket
    const connect = vi.fn()
    const resetWebSocket = vi.fn(() => {
      ws = null
    })

    const controller = createWebSocketReconnectController({
      connect,
      getWebSocket: () => ws,
      isActive: () => true,
      resetWebSocket,
    })

    controller.handleVisibilityChange()

    expect(resetWebSocket).not.toHaveBeenCalled()
    expect(connect).not.toHaveBeenCalled()
    hiddenSpy.mockRestore()
  })

  it('does not reconnect while the document is hidden', () => {
    const hiddenSpy = mockDocumentHidden(true)
    let ws: WebSocket | null = createWebSocketStub(WebSocket.CLOSED).socket
    const connect = vi.fn()
    const resetWebSocket = vi.fn(() => {
      ws = null
    })

    const controller = createWebSocketReconnectController({
      connect,
      getWebSocket: () => ws,
      isActive: () => true,
      resetWebSocket,
    })

    controller.handleVisibilityChange()

    expect(connect).not.toHaveBeenCalled()
    expect(resetWebSocket).not.toHaveBeenCalled()
    hiddenSpy.mockRestore()
  })

  it('probes an open socket with PING and accepts only PONG as proof of life', async () => {
    vi.useFakeTimers()
    const probeSocket = createProbeWebSocket()
    const probe = probeWebSocketWithPong(probeSocket.socket)

    expect(probeSocket.send).toHaveBeenCalledWith('PING')
    probeSocket.emit('message', new MessageEvent('message', { data: 'PONG' }))

    await expect(probe).resolves.toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reconnects an open socket that does not answer the visibility probe', async () => {
    vi.useFakeTimers()
    const hiddenSpy = mockDocumentHidden(false)
    const { socket, send, close } = createProbeWebSocket()
    let ws: WebSocket | null = socket
    const connect = vi.fn()
    const resetWebSocket = vi.fn(() => {
      ws = null
    })

    const controller = createWebSocketReconnectController({
      connect,
      getWebSocket: () => ws,
      isActive: () => true,
      probeWebSocket: probeWebSocketWithPong,
      resetWebSocket,
    })

    controller.handleVisibilityChange()
    expect(send).toHaveBeenCalledWith('PING')

    vi.advanceTimersByTime(5_000)
    await Promise.resolve()

    expect(resetWebSocket).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)

    vi.runOnlyPendingTimers()
    expect(connect).toHaveBeenCalledTimes(1)
    hiddenSpy.mockRestore()
  })

  it('uses one bounded exponential reconnect timer and resets after a stable connection', () => {
    vi.useFakeTimers()
    const ws = createWebSocketStub(WebSocket.CLOSED).socket
    const connect = vi.fn()
    const controller = createWebSocketReconnectController({
      connect,
      delayMs: 100,
      getWebSocket: () => ws,
      isActive: () => true,
      resetWebSocket: vi.fn(),
    })

    controller.scheduleReconnect()
    controller.scheduleReconnect()
    expect(vi.getTimerCount()).toBe(1)
    vi.runOnlyPendingTimers()
    expect(connect).toHaveBeenCalledTimes(1)

    controller.markConnected()
    vi.advanceTimersByTime(30_000)
    controller.scheduleReconnect()
    vi.runOnlyPendingTimers()
    expect(connect).toHaveBeenCalledTimes(2)
  })
})

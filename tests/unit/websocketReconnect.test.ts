import { closeWebSocketWhenReady, createWebSocketReconnectController } from '@/lib/websocket-reconnect'

afterEach(() => {
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

  it('forces a fresh socket when a configured stream becomes visible again', () => {
    const hiddenSpy = mockDocumentHidden(false)
    const staleSocket = createWebSocketStub(WebSocket.OPEN).socket
    let ws: WebSocket | null = staleSocket
    const connect = vi.fn()
    const disconnectWebSocket = vi.fn()
    const resetWebSocket = vi.fn(() => {
      ws = null
    })

    const controller = createWebSocketReconnectController({
      connect,
      disconnectWebSocket,
      getWebSocket: () => ws,
      isActive: () => true,
      reconnectOnVisible: true,
      resetWebSocket,
    })

    controller.handleVisibilityChange()

    expect(resetWebSocket).toHaveBeenCalledTimes(1)
    expect(disconnectWebSocket).toHaveBeenCalledWith(staleSocket)
    expect(connect).toHaveBeenCalledTimes(1)
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
      reconnectOnVisible: true,
      resetWebSocket,
    })

    controller.handleVisibilityChange()

    expect(connect).not.toHaveBeenCalled()
    expect(resetWebSocket).not.toHaveBeenCalled()
    hiddenSpy.mockRestore()
  })
})

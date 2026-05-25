import { closeWebSocketWhenReady } from '@/lib/websocket-reconnect'

function createWebSocketStub(readyState: number) {
  return {
    readyState,
    close: vi.fn(),
    addEventListener: vi.fn(),
  } as unknown as WebSocket
}

describe('closeWebSocketWhenReady', () => {
  it('closes connecting sockets immediately without waiting for open', () => {
    const ws = createWebSocketStub(WebSocket.CONNECTING)
    const closeOpenSocket = vi.fn()

    closeWebSocketWhenReady(ws, closeOpenSocket)

    expect(ws.close).toHaveBeenCalledTimes(1)
    expect(ws.addEventListener).not.toHaveBeenCalled()
    expect(closeOpenSocket).not.toHaveBeenCalled()
  })

  it('runs the graceful close callback for open sockets', () => {
    const ws = createWebSocketStub(WebSocket.OPEN)
    const closeOpenSocket = vi.fn()

    closeWebSocketWhenReady(ws, closeOpenSocket)

    expect(closeOpenSocket).toHaveBeenCalledWith(ws)
    expect(ws.close).not.toHaveBeenCalled()
  })

  it('ignores sockets that are already closing or closed', () => {
    const closingSocket = createWebSocketStub(WebSocket.CLOSING)
    const closedSocket = createWebSocketStub(WebSocket.CLOSED)
    const closeOpenSocket = vi.fn()

    closeWebSocketWhenReady(closingSocket, closeOpenSocket)
    closeWebSocketWhenReady(closedSocket, closeOpenSocket)

    expect(closingSocket.close).not.toHaveBeenCalled()
    expect(closedSocket.close).not.toHaveBeenCalled()
    expect(closeOpenSocket).not.toHaveBeenCalled()
  })
})

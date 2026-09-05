import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { WebSocketPlayground } from '@/app/[locale]/docs/_components/WebSocketPlayground'

import { stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

interface MessageEventLike {
  data: string
}

interface CloseEventLike {
  code: number
  reason: string
}

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  static instances: MockWebSocket[] = []

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEventLike) => void) | null = null
  onclose: ((event: CloseEventLike) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  readyState = MockWebSocket.CONNECTING
  url: string
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sentMessages.push(payload)
  }

  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  emitMessage(payload: string) {
    this.onmessage?.({ data: payload })
  }
}

describe('webSocketPlayground', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    unstubAllGlobals()
  })

  it('connects, sends, and receives messages', async () => {
    const user = userEvent.setup()

    render(<WebSocketPlayground endpoint="wss://example.com/stream" defaultMessage='{"type":"ping"}' />)

    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(MockWebSocket.instances).toHaveLength(1)
    const socket = MockWebSocket.instances[0]
    expect(socket.url).toBe('wss://example.com/stream')

    await act(async () => {
      socket.emitOpen()
    })

    expect(screen.getByText('Connected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send Message' }))
    expect(socket.sentMessages).toEqual(['{"type":"ping"}'])

    await act(async () => {
      socket.emitMessage('{"event":"trade"}')
    })

    expect(screen.getByText((content) => content.includes('{"event":"trade"}'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('appends token query parameter before connecting', async () => {
    const user = userEvent.setup()

    render(<WebSocketPlayground endpoint="wss://example.com/stream" authQueryKey="apiKey" />)

    await user.type(screen.getByLabelText('Token (apiKey query param)'), 'test-secret')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('wss://example.com/stream?apiKey=test-secret')
  })
})

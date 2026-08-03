import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveCommentsChannel } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useLiveCommentsChannel'

vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ wsLiveDataUrl: 'wss://example.com/live' }),
}))

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(readonly url: string | URL) {
    MockWebSocket.instances.push(this)
  }

  send() {}

  close() {
    this.readyState = MockWebSocket.CLOSED
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }
}

describe('useLiveCommentsChannel', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('reports live when the socket opens before any comments arrive', () => {
    const queryClient = new QueryClient()

    function QueryClientWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }

    const { result } = renderHook(() => useLiveCommentsChannel({ eventSlug: 'event-slug', user: null }), {
      wrapper: QueryClientWrapper,
    })

    expect(result.current.status).toBe('connecting')

    act(() => MockWebSocket.instances[0]?.emitOpen())

    expect(result.current.status).toBe('live')
  })
})

import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import { useLiveCommentsChannel } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useLiveCommentsChannel'

import { stubGlobal, unstubAllGlobals, useFakeTimers, useRealTimers } from '../bun-test-helpers'

void mock.module('@/hooks/usePublicRuntimeConfig', () => ({
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
  sentMessages: string[] = []

  constructor(readonly url: string | URL) {
    MockWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sentMessages.push(payload)
  }

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
    stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    cleanup()
    useRealTimers()
    unstubAllGlobals()
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

  it('reconnects a stale socket while the page remains visible', () => {
    useFakeTimers()
    const queryClient = new QueryClient()

    function QueryClientWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }

    const { result } = renderHook(() => useLiveCommentsChannel({ eventSlug: 'event-slug', user: null }), {
      wrapper: QueryClientWrapper,
    })
    const socket = MockWebSocket.instances[0]!

    act(() => socket.emitOpen())
    act(() => {
      jest.advanceTimersByTime(75_000)
    })

    expect(socket.sentMessages).toContain('PING')
    expect(socket.readyState).toBe(MockWebSocket.CLOSED)
    expect(result.current.status).toBe('offline')

    act(() => {
      jest.advanceTimersByTime(2_000)
    })
    expect(MockWebSocket.instances).toHaveLength(2)
  })
})

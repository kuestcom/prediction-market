import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useEventActivityWebSocket } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventActivityWebSocket'

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  send = vi.fn()
  private listeners = new Map<string, Set<EventListener>>()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  receive(payload: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }))
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
  }
}

describe('useEventActivityWebSocket', () => {
  const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')

  beforeEach(() => {
    MockWebSocket.instances = []
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    if (hiddenDescriptor) {
      Object.defineProperty(document, 'hidden', hiddenDescriptor)
    } else {
      Reflect.deleteProperty(document, 'hidden')
    }
  })

  it('clears the heartbeat before replacing a socket that fails a visibility probe', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() =>
      useEventActivityWebSocket({
        eventSlug: 'My-Event',
        onActivities: vi.fn(),
        wsUrl: 'wss://ws-live-data.example',
      }),
    )
    const socket = MockWebSocket.instances[0]!

    act(() => socket.open())
    expect(vi.getTimerCount()).toBe(2)

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(vi.getTimerCount()).toBe(3)

    await act(async () => vi.advanceTimersByTime(5_000))
    expect(socket.readyState).toBe(MockWebSocket.CLOSED)
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(MockWebSocket.instances).toHaveLength(2)
    unmount()
  })

  it('subscribes by event slug and forwards matched activity payloads', () => {
    const onActivities = vi.fn()
    const { unmount } = renderHook(() =>
      useEventActivityWebSocket({
        eventSlug: 'My-Event',
        onActivities,
        wsUrl: 'wss://ws-live-data.example',
      }),
    )
    const socket = MockWebSocket.instances[0]

    expect(socket?.url).toBe('wss://ws-live-data.example')

    act(() => socket?.open())

    expect(socket?.send).toHaveBeenCalledWith(
      JSON.stringify({
        action: 'subscribe',
        subscriptions: [
          {
            topic: 'activity',
            type: 'orders_matched',
            filters: { event_slug: 'my-event' },
          },
        ],
      }),
    )

    act(() => {
      socket?.receive({ topic: 'comments', type: 'comment_created', payload: {} })
      socket?.receive({
        topic: 'activity',
        type: 'orders_matched',
        payload: { conditionId: 'condition-1', timestamp: 1 },
      })
    })

    expect(onActivities).toHaveBeenCalledOnce()
    expect(onActivities).toHaveBeenCalledWith([{ conditionId: 'condition-1', timestamp: 1 }])

    unmount()
    expect(socket?.send).toHaveBeenLastCalledWith(
      JSON.stringify({
        action: 'unsubscribe',
        subscriptions: [
          {
            topic: 'activity',
            type: 'orders_matched',
            filters: { event_slug: 'my-event' },
          },
        ],
      }),
    )
    expect(socket?.readyState).toBe(MockWebSocket.CLOSED)
  })
})

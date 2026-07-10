import { act, cleanup, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveSeriesWebSocket } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useLiveSeriesWebSocket'
import {
  resolveLivePriceTransitionDuration,
  SERIES_KEY,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventLiveSeriesChartUtils'

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

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>)
  }
}

describe('useLiveSeriesWebSocket', () => {
  let now = 1_800_000_000_000
  let dateNowSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    now = 1_800_000_000_000
    MockWebSocket.instances = []
    window.localStorage.clear()
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function mountHook(eventEndTimestamp: number | null = null) {
    const view = renderHook(() => {
      const [baseline, setBaseline] = useState<number | null>(null)
      const live = useLiveSeriesWebSocket({
        topic: 'crypto_prices',
        eventType: 'price',
        eventEndTimestamp,
        subscriptionSymbol: 'BTC',
        isLiveView: true,
        setBaselinePrice: setBaseline,
      })

      return { ...live, baseline }
    })

    const socket = MockWebSocket.instances[0]!
    act(() => socket.emitOpen())
    return { ...view, socket }
  }

  it.each([
    { prices: [100] },
    { prices: [100, 101] },
  ])('loads a $prices.length-point subscribe payload as the initial snapshot', ({ prices }) => {
    const { result, socket } = mountHook()
    const snapshot = prices.map((price, index) => ({
      symbol: 'BTC',
      value: price,
      timestamp: now - (prices.length - index) * 1_000,
    }))

    act(() => socket.emitMessage({
      type: 'subscribe',
      payload: { data: snapshot },
    }))

    expect(result.current.data.map(point => [point.date.getTime(), point[SERIES_KEY]])).toEqual(
      snapshot.map(point => [point.timestamp, point.value]),
    )
    expect(result.current.baseline).toBe(100)
    expect(result.current.status).toBe('live')
  })

  it('uses the latest batch value and retargets from the in-flight visual price', () => {
    const { result, socket } = mountHook()
    const initialNow = now

    act(() => socket.emitMessage({
      type: 'subscribe',
      data: [{ symbol: 'BTC', value: 100, timestamp: initialNow - 500 }],
    }))

    const callsBeforeUpdates = dateNowSpy.mock.calls.length
    act(() => {
      now = initialNow + 100
      socket.emitMessage({
        type: 'update',
        topic: 'crypto_prices',
        symbol: 'BTC',
        value: 110,
        timestamp: now,
      })

      now = initialNow + 200
      socket.emitMessage({
        type: 'update',
        data: [
          { symbol: 'BTC', value: 90, timestamp: initialNow + 195 },
          { symbol: 'BTC', value: 92, timestamp: initialNow + 190 },
        ],
      })
    })

    expect(dateNowSpy.mock.calls.length - callsBeforeUpdates).toBe(2)

    const retargetStart = initialNow + 200
    const transition = result.current.data.filter(point => point.date.getTime() >= retargetStart)
    const firstPrice = transition[0]?.[SERIES_KEY] as number
    const duration = resolveLivePriceTransitionDuration(initialNow + 100, retargetStart)

    expect(transition[0]?.date.getTime()).toBe(retargetStart)
    expect(firstPrice).toBeGreaterThan(100)
    expect(firstPrice).toBeLessThan(110)
    expect(transition.at(-1)?.date.getTime()).toBe(retargetStart + duration)
    expect(transition.at(-1)?.[SERIES_KEY]).toBe(90)
    expect(result.current.baseline).toBe(100)
  })

  it('finishes the last transition at the event cutoff and ignores later updates', () => {
    const initialNow = now
    const eventEndTimestamp = initialNow + 150
    const { result, socket } = mountHook(eventEndTimestamp)

    act(() => socket.emitMessage({
      type: 'subscribe',
      data: [{ symbol: 'BTC', value: 100, timestamp: initialNow - 500 }],
    }))

    now = initialNow + 100
    act(() => socket.emitMessage({
      type: 'update',
      symbol: 'BTC',
      value: 110,
      timestamp: now,
    }))

    expect(result.current.data.at(-1)?.date.getTime()).toBe(eventEndTimestamp)
    expect(result.current.data.at(-1)?.[SERIES_KEY]).toBe(110)

    const dataAtCutoff = result.current.data
    now = eventEndTimestamp + 1
    act(() => socket.emitMessage({
      type: 'update',
      symbol: 'BTC',
      value: 120,
      timestamp: now,
    }))

    expect(result.current.data).toBe(dataAtCutoff)
  })

  it('accepts a pre-close update delivered after the event cutoff', () => {
    const initialNow = now
    const eventEndTimestamp = initialNow + 150
    const { result, socket } = mountHook(eventEndTimestamp)

    act(() => socket.emitMessage({
      type: 'subscribe',
      data: [{ symbol: 'BTC', value: 100, timestamp: initialNow - 500 }],
    }))

    now = eventEndTimestamp + 1_000
    act(() => socket.emitMessage({
      type: 'update',
      symbol: 'BTC',
      value: 110,
      timestamp: eventEndTimestamp - 1,
    }))

    expect(result.current.data.at(-1)).toEqual({
      date: new Date(eventEndTimestamp),
      [SERIES_KEY]: 110,
    })
    expect(JSON.parse(window.localStorage.getItem('kuest-live-last-price:crypto_prices:BTC')!)).toEqual({
      price: 110,
      timestamp: eventEndTimestamp - 1,
    })
  })
})

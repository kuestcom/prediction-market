import type { Event, EventSeriesEntry } from '@/types'
import type { DataPoint } from '@/types/PredictionChartTypes'
import { describe, expect, it } from 'vitest'
import {
  appendLivePriceTransition,
  findLiveSeriesEvent,
  LIVE_PRICE_TRANSITION_MS,
  MAX_POINTS,
  resolveEventEndTimestamp,
  resolveLivePriceTransitionDuration,
  resolveLiveSeriesDisplayPrice,
  SERIES_KEY,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventLiveSeriesChartUtils'

function createLivePoint(timestamp: number, price: number): DataPoint {
  return {
    date: new Date(timestamp),
    [SERIES_KEY]: price,
  }
}

function createSeriesEvent(overrides: Partial<EventSeriesEntry> = {}): EventSeriesEntry {
  return {
    id: 'series-event-1',
    slug: 'bitcoin-up-or-down-on-june-23-2026',
    status: 'active',
    end_date: '2026-06-24T00:00:00.000Z',
    resolved_at: null,
    created_at: '2026-06-23T00:00:00.000Z',
    ...overrides,
  }
}

function readLivePrice(point: DataPoint) {
  return point[SERIES_KEY] as number
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'bitcoin-up-or-down-on-june-22-2026',
    title: 'Bitcoin Up or Down on June 22, 2026?',
    creator: 'creator',
    icon_url: '',
    show_market_icons: false,
    status: 'active',
    active_markets_count: 1,
    total_markets_count: 1,
    volume: 0,
    start_date: '2026-06-22T23:55:00.000Z',
    end_date: '2026-06-23T00:00:00.000Z',
    resolved_at: null,
    created_at: '2026-06-22T00:00:00.000Z',
    updated_at: '2026-06-22T00:00:00.000Z',
    markets: [
      {
        condition_id: 'condition-1',
        question_id: 'question-1',
        event_id: 'event-1',
        title: 'Bitcoin Up or Down on June 22, 2026?',
        slug: 'bitcoin-up-or-down-on-june-22-2026',
        icon_url: '',
        is_active: false,
        is_resolved: false,
        block_number: 1,
        block_timestamp: '2026-06-22T00:00:00.000Z',
        volume_24h: 0,
        volume: 0,
        end_time: '2026-06-23T00:00:00.000Z',
        created_at: '2026-06-22T00:00:00.000Z',
        updated_at: '2026-06-22T00:00:00.000Z',
        price: 0,
        probability: 0,
        outcomes: [],
        condition: {
          id: 'condition-1',
          oracle: 'oracle',
          question_id: 'question-1',
          outcome_slot_count: 2,
          resolved: false,
          volume: 0,
          open_interest: 0,
          active_positions_count: 0,
          created_at: '2026-06-22T00:00:00.000Z',
          updated_at: '2026-06-22T00:00:00.000Z',
        },
      },
    ],
    tags: [],
    main_tag: 'Crypto',
    is_bookmarked: false,
    is_trending: false,
    ...overrides,
  }
}

describe('event live series chart utils', () => {
  it.each([
    { startPrice: 100, targetPrice: 110 },
    { startPrice: 110, targetPrice: 100 },
  ])('builds a monotonic live transition from $startPrice to $targetPrice', ({ startPrice, targetPrice }) => {
    const transitionStart = 10_000
    const result = appendLivePriceTransition(
      [createLivePoint(1_000, startPrice)],
      targetPrice,
      transitionStart,
    )
    const transition = result.filter(point => point.date.getTime() >= transitionStart)
    const prices = transition.map(readLivePrice)

    expect(transition.length).toBeGreaterThan(10)
    expect(transition[0]?.date.getTime()).toBe(transitionStart)
    expect(prices[0]).toBe(startPrice)
    expect(transition.at(-1)?.date.getTime()).toBe(transitionStart + LIVE_PRICE_TRANSITION_MS)
    expect(prices.at(-1)).toBe(targetPrice)

    for (let index = 1; index < transition.length; index += 1) {
      expect(transition[index]!.date.getTime()).toBeGreaterThan(transition[index - 1]!.date.getTime())
      if (targetPrice > startPrice) {
        expect(prices[index]).toBeGreaterThan(prices[index - 1]!)
      }
      else {
        expect(prices[index]).toBeLessThan(prices[index - 1]!)
      }
    }
  })

  it('retargets an in-flight transition from the currently displayed price', () => {
    const firstTransitionStart = 10_000
    const retargetTimestamp = firstTransitionStart + 173
    const firstTransition = appendLivePriceTransition(
      [createLivePoint(1_000, 100)],
      110,
      firstTransitionStart,
    )
    const pointBeforeRetarget = firstTransition
      .filter(point => point.date.getTime() < retargetTimestamp)
      .at(-1)!
    const pointAfterRetarget = firstTransition
      .find(point => point.date.getTime() > retargetTimestamp)!
    const interpolationProgress = (
      retargetTimestamp - pointBeforeRetarget.date.getTime()
    ) / (
      pointAfterRetarget.date.getTime() - pointBeforeRetarget.date.getTime()
    )
    const expectedRetargetPrice = readLivePrice(pointBeforeRetarget) + (
      readLivePrice(pointAfterRetarget) - readLivePrice(pointBeforeRetarget)
    ) * interpolationProgress
    const result = appendLivePriceTransition(
      firstTransition,
      90,
      retargetTimestamp,
    )
    const retargetedTransition = result.filter(point => point.date.getTime() >= retargetTimestamp)
    const retargetedPrices = retargetedTransition.map(readLivePrice)

    expect(retargetedTransition[0]?.date.getTime()).toBe(retargetTimestamp)
    expect(retargetedPrices[0]).toBeCloseTo(expectedRetargetPrice, 8)
    expect(retargetedPrices.at(-1)).toBe(90)
    expect(result.some(point => (
      point.date.getTime() > retargetTimestamp
      && readLivePrice(point) > (retargetedPrices[0] ?? Number.POSITIVE_INFINITY)
    ))).toBe(false)
  })

  it('does not restart a transition when the WS repeats the same target', () => {
    const transitionStart = 10_000
    const firstTransition = appendLivePriceTransition(
      [createLivePoint(1_000, 100)],
      110,
      transitionStart,
    )
    const repeatedTarget = appendLivePriceTransition(
      firstTransition,
      110,
      transitionStart + 200,
    )

    expect(repeatedTarget).toEqual(firstTransition)
    expect(repeatedTarget.at(-1)?.date.getTime()).toBe(transitionStart + LIVE_PRICE_TRANSITION_MS)
  })

  it('keeps the smoothed live history within the chart point limit', () => {
    const points = Array.from({ length: MAX_POINTS }, (_value, index) => (
      createLivePoint(index * 10, 100)
    ))
    const result = appendLivePriceTransition(points, 110, MAX_POINTS * 10)

    expect(result).toHaveLength(MAX_POINTS)
    expect(result.at(-1)?.[SERIES_KEY]).toBe(110)
  })

  it('adapts the transition duration to the incoming message cadence', () => {
    expect(resolveLivePriceTransitionDuration(null, 10_000)).toBe(LIVE_PRICE_TRANSITION_MS)
    expect(resolveLivePriceTransitionDuration(9_900, 10_000)).toBe(120)
    expect(resolveLivePriceTransitionDuration(9_500, 10_000)).toBe(400)
    expect(resolveLivePriceTransitionDuration(8_000, 10_000)).toBe(LIVE_PRICE_TRANSITION_MS)
  })

  it('keeps up with a rapid sequence of distinct price targets', () => {
    let points = [createLivePoint(0, 100)]
    let previousTimestamp: number | null = null

    for (let update = 1; update <= 20; update += 1) {
      const timestamp = update * 100
      const duration = resolveLivePriceTransitionDuration(previousTimestamp, timestamp)
      points = appendLivePriceTransition(points, 100 + update, timestamp, duration)
      previousTimestamp = timestamp
    }

    const finalTransitionStart = points.find(point => point.date.getTime() === 2_000)
    expect(finalTransitionStart?.[SERIES_KEY]).toBeGreaterThan(118)
    expect(points.at(-1)?.[SERIES_KEY]).toBe(120)
    expect(points.at(-1)?.date.getTime()).toBe(2_120)
  })

  it('falls back to the default transition duration for a non-finite duration', () => {
    const transitionStart = 10_000
    const result = appendLivePriceTransition(
      [createLivePoint(1_000, 100)],
      110,
      transitionStart,
      Number.POSITIVE_INFINITY,
    )

    expect(result.at(-1)?.date.getTime()).toBe(transitionStart + LIVE_PRICE_TRANSITION_MS)
    expect(result.at(-1)?.[SERIES_KEY]).toBe(110)
  })

  it('uses event resolved_at as the live chart end timestamp', () => {
    const resolvedAt = '2026-06-22T23:59:12.000Z'
    const event = createEvent({
      status: 'resolved',
      resolved_at: resolvedAt,
      end_date: '2026-06-23T00:00:00.000Z',
    })

    expect(resolveEventEndTimestamp(event)).toBe(Date.parse(resolvedAt))
  })

  it('finds the next active series event in its trading window', () => {
    const nowTimestamp = Date.parse('2026-06-23T23:55:00.000Z')
    const liveEvent = createSeriesEvent()
    const laterEvent = createSeriesEvent({
      id: 'series-event-2',
      slug: 'bitcoin-up-or-down-on-june-24-2026',
      end_date: '2026-06-25T00:00:00.000Z',
    })

    expect(findLiveSeriesEvent(
      [laterEvent, liveEvent],
      'bitcoin-up-or-down-on-june-22-2026',
      nowTimestamp,
      10 * 60 * 1000,
    )).toBe(liveEvent)
  })

  it('does not treat the current, ended, future, or inactive series event as live', () => {
    const currentSlug = 'bitcoin-up-or-down-on-june-23-2026'
    const nowTimestamp = Date.parse('2026-06-24T00:05:00.000Z')

    expect(findLiveSeriesEvent(
      [
        createSeriesEvent({ slug: currentSlug, end_date: '2026-06-24T00:10:00.000Z' }),
        createSeriesEvent({ slug: 'ended', end_date: '2026-06-24T00:05:00.000Z' }),
        createSeriesEvent({ slug: 'future', end_date: '2026-06-24T00:20:01.000Z' }),
        createSeriesEvent({ slug: 'draft', status: 'draft', end_date: '2026-06-24T00:10:00.000Z' }),
      ],
      currentSlug,
      nowTimestamp,
      15 * 60 * 1000,
    )).toBeNull()
  })

  it('falls back to resolved condition timestamps for resolved events', () => {
    const conditionResolvedAt = '2026-06-22T23:59:40.000Z'
    const baseMarket = createEvent().markets[0]!
    const event = createEvent({
      status: 'resolved',
      resolved_at: null,
      markets: [
        {
          ...baseMarket,
          is_resolved: true,
          condition: {
            ...baseMarket.condition,
            resolved: true,
            resolved_at: conditionResolvedAt,
          },
        },
      ],
    })

    expect(resolveEventEndTimestamp(event)).toBe(Date.parse(conditionResolvedAt))
  })

  it('does not use one resolved market timestamp for active multi-market events', () => {
    const conditionResolvedAt = '2026-06-22T23:59:40.000Z'
    const baseMarket = createEvent().markets[0]!
    const event = createEvent({
      status: 'active',
      total_markets_count: 2,
      markets: [
        {
          ...baseMarket,
          is_resolved: true,
          condition: {
            ...baseMarket.condition,
            resolved: true,
            resolved_at: conditionResolvedAt,
          },
        },
        {
          ...baseMarket,
          condition_id: 'condition-2',
          condition: {
            ...baseMarket.condition,
            id: 'condition-2',
          },
        },
      ],
    })

    expect(resolveEventEndTimestamp(event)).toBe(Date.parse('2026-06-23T00:00:00.000Z'))
  })

  it('uses the final price for closed live series charts', () => {
    expect(resolveLiveSeriesDisplayPrice({
      isEventClosed: true,
      finalPrice: 105,
      renderedPrice: 104,
      fallbackCurrentPrice: 103,
    })).toBe(105)
  })

  it('falls back to the rendered chart price for closed live series charts without a final price', () => {
    expect(resolveLiveSeriesDisplayPrice({
      isEventClosed: true,
      finalPrice: null,
      renderedPrice: 104,
      fallbackCurrentPrice: 103,
    })).toBe(104)
  })

  it('uses the live fallback price only for open live series charts without rendered data', () => {
    expect(resolveLiveSeriesDisplayPrice({
      isEventClosed: false,
      finalPrice: null,
      renderedPrice: null,
      fallbackCurrentPrice: 103,
    })).toBe(103)
  })
})

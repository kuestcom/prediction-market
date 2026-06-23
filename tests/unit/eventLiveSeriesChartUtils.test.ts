import type { Event } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  resolveEventEndTimestamp,
  resolveLiveSeriesDisplayPrice,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventLiveSeriesChartUtils'

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
  it('uses event resolved_at as the live chart end timestamp', () => {
    const resolvedAt = '2026-06-22T23:59:12.000Z'
    const event = createEvent({
      status: 'resolved',
      resolved_at: resolvedAt,
      end_date: '2026-06-23T00:00:00.000Z',
    })

    expect(resolveEventEndTimestamp(event)).toBe(Date.parse(resolvedAt))
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

import type { Market } from '@/types'
import { describe, expect, it } from 'vitest'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import {
  resolveFallbackOutcomeUnitPrice,
  resolveOutcomePriceCents,
  resolveOutcomeUnitPrice,
} from '@/lib/market-pricing'

describe('market pricing helpers', () => {
  function createMarket(overrides: Partial<Market> = {}): Market {
    return {
      condition_id: overrides.condition_id ?? 'condition-1',
      question_id: overrides.question_id ?? 'question-1',
      event_id: overrides.event_id ?? 'event-1',
      title: overrides.title ?? 'Market title',
      slug: overrides.slug ?? 'market-title',
      icon_url: overrides.icon_url ?? '',
      is_active: overrides.is_active ?? true,
      is_resolved: overrides.is_resolved ?? false,
      block_number: overrides.block_number ?? 0,
      block_timestamp: overrides.block_timestamp ?? new Date().toISOString(),
      volume_24h: overrides.volume_24h ?? 0,
      volume: overrides.volume ?? 0,
      created_at: overrides.created_at ?? new Date().toISOString(),
      updated_at: overrides.updated_at ?? new Date().toISOString(),
      price: overrides.price ?? 0.55,
      probability: overrides.probability ?? 55,
      outcomes: overrides.outcomes ?? [
        {
          condition_id: 'condition-1',
          outcome_text: 'Yes',
          outcome_index: OUTCOME_INDEX.YES,
          token_id: 'yes-token',
          is_winning_outcome: false,
          buy_price: 0.55,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          condition_id: 'condition-1',
          outcome_text: 'No',
          outcome_index: OUTCOME_INDEX.NO,
          token_id: 'no-token',
          is_winning_outcome: false,
          buy_price: 0.45,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      condition: overrides.condition ?? {
        id: 'condition-1',
        oracle: '',
        question_id: 'question-1',
        outcome_slot_count: 2,
        resolved: false,
      },
    }
  }

  it('falls back to the explicit outcome buy price when no order book is available', () => {
    const market = createMarket()

    expect(resolveFallbackOutcomeUnitPrice(market, OUTCOME_INDEX.YES)).toBe(0.55)
    expect(resolveFallbackOutcomeUnitPrice(market, OUTCOME_INDEX.NO)).toBe(0.45)
  })

  it('uses the selected outcome token book instead of complementing the yes quote', () => {
    const market = createMarket()

    const noPrice = resolveOutcomeUnitPrice(market, OUTCOME_INDEX.NO, {
      orderBookSummaries: {
        'yes-token': {
          bids: [{ price: '0.70', size: '10' }],
          asks: [{ price: '0.71', size: '10' }],
        },
        'no-token': {
          bids: [{ price: '0.11', size: '10' }],
          asks: [{ price: '0.12', size: '10' }],
        },
      },
      side: ORDER_SIDE.BUY,
    })

    expect(noPrice).toBe(0.12)
  })

  it('switches between ask and bid based on the trading side', () => {
    const market = createMarket()

    expect(resolveOutcomeUnitPrice(market, OUTCOME_INDEX.YES, {
      orderBookSummaries: {
        'yes-token': {
          bids: [{ price: '0.61', size: '10' }],
          asks: [{ price: '0.63', size: '10' }],
        },
      },
      side: ORDER_SIDE.BUY,
    })).toBe(0.63)

    expect(resolveOutcomeUnitPrice(market, OUTCOME_INDEX.YES, {
      orderBookSummaries: {
        'yes-token': {
          bids: [{ price: '0.61', size: '10' }],
          asks: [{ price: '0.63', size: '10' }],
        },
      },
      side: ORDER_SIDE.SELL,
    })).toBe(0.61)
  })

  it('converts the resolved price into cents with the same rounding path', () => {
    const market = createMarket()

    expect(resolveOutcomePriceCents(market, OUTCOME_INDEX.NO, {
      orderBookSummaries: {
        'no-token': {
          asks: [{ price: '0.124', size: '10' }],
        },
      },
      side: ORDER_SIDE.BUY,
    })).toBe(12.4)
  })
})

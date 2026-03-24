import type { Market } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  resolveBinaryOutcomeByIndex,
  resolveBinaryWinningOutcomeIndex,
  resolveEventCardResolvedOutcomeIndex,
  shouldUseResolvedXTracker,
} from '@/app/[locale]/(platform)/(home)/_utils/eventCardResolvedOutcome'

function createMarket(overrides: Partial<Market> = {}): Market {
  return {
    condition_id: 'condition-1',
    question_id: 'question-1',
    event_id: 'event-1',
    title: '340-359',
    slug: 'elon-musk-of-tweets-march-17-march-24-340-359',
    short_title: '340-359',
    icon_url: '',
    is_active: false,
    is_resolved: true,
    block_number: 0,
    block_timestamp: '',
    metadata: null,
    volume_24h: 0,
    volume: 0,
    created_at: '',
    updated_at: '',
    price: 0.5,
    probability: 0.5,
    outcomes: [
      {
        condition_id: 'condition-1',
        outcome_text: 'Yes',
        outcome_index: 0,
        token_id: 'yes-token',
        is_winning_outcome: false,
        created_at: '',
        updated_at: '',
      },
      {
        condition_id: 'condition-1',
        outcome_text: 'No',
        outcome_index: 1,
        token_id: 'no-token',
        is_winning_outcome: false,
        created_at: '',
        updated_at: '',
      },
    ],
    condition: {
      id: 'condition-1',
      oracle: '',
      question_id: 'question-1',
      outcome_slot_count: 2,
      resolved: true,
      volume: 0,
      open_interest: 0,
      active_positions_count: 0,
      created_at: '',
      updated_at: '',
    },
    ...overrides,
  }
}

describe('eventCardResolvedOutcome', () => {
  it('prefers explicit winning outcomes when available', () => {
    const market = createMarket({
      outcomes: [
        {
          condition_id: 'condition-1',
          outcome_text: 'Yes',
          outcome_index: 0,
          token_id: 'yes-token',
          is_winning_outcome: true,
          created_at: '',
          updated_at: '',
        },
        {
          condition_id: 'condition-1',
          outcome_text: 'No',
          outcome_index: 1,
          token_id: 'no-token',
          is_winning_outcome: false,
          created_at: '',
          updated_at: '',
        },
      ],
    })

    expect(resolveBinaryWinningOutcomeIndex(market)).toBe(0)
  })

  it('falls back to payout numerators for resolved binary markets', () => {
    const market = createMarket({
      condition: {
        ...createMarket().condition,
        payout_numerators: [0, 1],
      },
    })

    expect(resolveBinaryWinningOutcomeIndex(market)).toBe(1)
    expect(resolveBinaryOutcomeByIndex(market, 1)?.outcome_text).toBe('No')
  })

  it('infers tweet market winners for neg-risk cards without payout metadata', () => {
    const market = createMarket()

    expect(
      resolveEventCardResolvedOutcomeIndex(market, {
        isTweetMarketEvent: true,
        isTweetMarketFinal: true,
        totalCount: 367,
      }),
    ).toBe(1)
  })

  it('infers numeric range winners from resolution price when payout metadata is missing', () => {
    const market = createMarket({
      condition: {
        ...createMarket().condition,
        resolution_price: 347,
      },
    })

    expect(
      resolveEventCardResolvedOutcomeIndex(market, {
        isTweetMarketEvent: false,
        isTweetMarketFinal: true,
        totalCount: null,
      }),
    ).toBe(0)
  })

  it('does not infer non-tweet markets without resolution metadata', () => {
    const market = createMarket()

    expect(
      resolveEventCardResolvedOutcomeIndex(market, {
        isTweetMarketEvent: false,
        isTweetMarketFinal: true,
        totalCount: 367,
      }),
    ).toBeNull()
  })

  it('enables xtracker resolution for tweet range events even when tags are missing', () => {
    expect(shouldUseResolvedXTracker({
      title: 'Elon Musk # tweets March 17 - March 24, 2026?',
      slug: 'elon-musk-of-tweets-march-17-march-24',
      tags: [],
      markets: [createMarket()],
    })).toBe(true)
  })

  it('does not enable xtracker resolution for non-tweet range events', () => {
    expect(shouldUseResolvedXTracker({
      title: 'Lakers spread March 17',
      slug: 'lakers-spread-march-17',
      tags: [],
      markets: [{
        short_title: '340-359',
        title: '340-359',
        slug: 'lakers-spread-340-359',
        resolution_source: null,
        resolution_source_url: null,
      }],
    })).toBe(false)
  })
})

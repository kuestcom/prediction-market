import type { Event, Market, Outcome } from '@/types'
import { describe, expect, it } from 'vitest'
import { buildEventFaqItems } from '@/lib/event-faq'

function createOutcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    condition_id: 'condition-1',
    outcome_text: 'Yes',
    outcome_index: 0,
    token_id: 'token-1',
    is_winning_outcome: false,
    created_at: '2026-02-28T00:00:00.000Z',
    updated_at: '2026-02-28T00:00:00.000Z',
    ...overrides,
  }
}

function createMarket(overrides: Partial<Market> = {}): Market {
  return {
    condition_id: 'condition-1',
    question_id: 'question-1',
    event_id: 'event-1',
    title: 'Yes',
    slug: 'market-1',
    icon_url: '',
    is_active: true,
    is_resolved: false,
    block_number: 1,
    block_timestamp: '2026-02-28T00:00:00.000Z',
    volume_24h: 0,
    volume: 0,
    created_at: '2026-02-28T00:00:00.000Z',
    updated_at: '2026-02-28T00:00:00.000Z',
    price: 0.5,
    probability: 50,
    outcomes: [
      createOutcome({ outcome_text: 'Yes', outcome_index: 0, buy_price: 0.5 }),
      createOutcome({ outcome_text: 'No', outcome_index: 1, token_id: 'token-2', buy_price: 0.5 }),
    ],
    condition: {
      id: 'condition-1',
      oracle: '0x123',
      question_id: 'question-1',
      outcome_slot_count: 2,
      resolved: false,
      volume: 0,
      open_interest: 0,
      active_positions_count: 0,
      created_at: '2026-02-28T00:00:00.000Z',
      updated_at: '2026-02-28T00:00:00.000Z',
    },
    ...overrides,
  }
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Sample event',
    creator: 'creator',
    icon_url: '',
    show_market_icons: true,
    status: 'active',
    active_markets_count: 1,
    total_markets_count: 1,
    volume: 0,
    end_date: '2026-03-07T00:00:00.000Z',
    created_at: '2026-02-28T00:00:00.000Z',
    updated_at: '2026-02-28T00:00:00.000Z',
    markets: [createMarket()],
    tags: [],
    main_tag: 'World',
    is_bookmarked: false,
    is_trending: false,
    ...overrides,
  }
}

describe('buildEventFaqItems', () => {
  it('builds a multi-outcome FAQ', () => {
    const event = createEvent({
      title: 'Bitcoin above ___ on March 7?',
      total_markets_count: 11,
      volume: 4_900_000,
      markets: [
        createMarket({
          condition_id: 'condition-56k',
          title: '56,000',
          slug: '56-000',
          price: 1,
          probability: 100,
          outcomes: [
            createOutcome({ condition_id: 'condition-56k', outcome_text: 'Yes', outcome_index: 0, token_id: 'token-56k', buy_price: 1 }),
            createOutcome({ condition_id: 'condition-56k', outcome_text: 'No', outcome_index: 1, token_id: 'token-56k-no', buy_price: 0 }),
          ],
          condition: {
            id: 'condition-56k',
            oracle: '0x123',
            question_id: 'question-56k',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-02-28T00:00:00.000Z',
            updated_at: '2026-02-28T00:00:00.000Z',
          },
        }),
        createMarket({
          condition_id: 'condition-58k',
          title: '58,000',
          slug: '58-000',
          price: 0.82,
          probability: 82,
          outcomes: [
            createOutcome({ condition_id: 'condition-58k', outcome_text: 'Yes', outcome_index: 0, token_id: 'token-58k', buy_price: 0.82 }),
            createOutcome({ condition_id: 'condition-58k', outcome_text: 'No', outcome_index: 1, token_id: 'token-58k-no', buy_price: 0.18 }),
          ],
          condition: {
            id: 'condition-58k',
            oracle: '0x123',
            question_id: 'question-58k',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-02-28T00:00:00.000Z',
            updated_at: '2026-02-28T00:00:00.000Z',
          },
        }),
      ],
    })

    const items = buildEventFaqItems({
      event,
      siteName: 'Kuest',
      commentsCount: 3655,
    })

    expect(items).toHaveLength(12)
    expect(items[0]?.answer).toContain('with 11 possible outcomes')
    expect(items[0]?.answer).toContain('The current leading outcome is "56,000" at 100¢')
    expect(items[1]?.answer).toContain('$4.9 million')
    expect(items[3]?.answer).toContain('The current frontrunner for "Bitcoin above ___ on March 7?" is "56,000" at 100¢')
    expect(items[8]?.question).toBe('What does a price of 100¢ for "56,000" mean?')
    expect(items[10]?.answer).toContain('3,655 comments')
  })

  it('builds a binary FAQ', () => {
    const event = createEvent({
      title: 'Nothing Ever Happens: 2026',
      volume: 17_200,
      markets: [
        createMarket({
          title: 'Nothing Ever Happens: 2026',
          slug: 'nothing-ever-happens',
          price: 0.63,
          probability: 63,
          outcomes: [
            createOutcome({ outcome_text: 'Yes', outcome_index: 0, token_id: 'token-yes', buy_price: 0.63 }),
            createOutcome({ outcome_text: 'No', outcome_index: 1, token_id: 'token-no', buy_price: 0.37 }),
          ],
        }),
      ],
    })

    const items = buildEventFaqItems({
      event,
      siteName: 'Kuest',
      commentsCount: 16,
    })

    expect(items[0]?.answer).toContain('buy and sell "Yes" or "No" shares')
    expect(items[0]?.answer).toContain('The current crowd-sourced probability is 63% for "Yes."')
    expect(items[1]?.answer).toContain('$17.2K')
    expect(items[3]?.answer).toContain('The current probability for "Nothing Ever Happens: 2026" is 63% for "Yes."')
    expect(items[8]?.question).toBe('What does a price of 63¢ for "Yes" mean?')
    expect(items[8]?.answer).toContain('On Kuest, the price of "Yes" or "No" represents the market\'s implied probability.')
    expect(items[10]?.answer).toContain('16 comments')
  })

  it('uses the low-volume, low-comments, and resolved branches', () => {
    const event = createEvent({
      title: 'Will a US court rule against Trump tariffs by Apr 2?',
      status: 'resolved',
      resolved_at: '2026-03-05T00:00:00.000Z',
      volume: 7244,
      markets: [
        createMarket({
          title: 'Will a US court rule against Trump tariffs by Apr 2?',
          slug: 'trump-tariffs',
          is_resolved: true,
          outcomes: [
            createOutcome({ outcome_text: 'Yes', outcome_index: 0, token_id: 'token-yes', buy_price: 0.41 }),
            createOutcome({ outcome_text: 'No', outcome_index: 1, token_id: 'token-no', buy_price: 0.59 }),
          ],
          condition: {
            id: 'condition-1',
            oracle: '0x123',
            question_id: 'question-1',
            outcome_slot_count: 2,
            resolved: true,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-02-28T00:00:00.000Z',
            updated_at: '2026-02-28T00:00:00.000Z',
          },
        }),
      ],
    })

    const items = buildEventFaqItems({
      event,
      siteName: 'Kuest',
      commentsCount: 2,
    })

    expect(items[1]?.answer).toContain('newly created market')
    expect(items[1]?.answer).toContain('opportunity to be among the first traders')
    expect(items[6]?.answer).toContain('real traders putting real money behind their beliefs')
    expect(items[9]?.answer).toContain('has been resolved')
    expect(items[10]?.answer).toContain('Be one of the first to share your analysis')
  })

  it('uses the generic multi-outcome template for sports events too', () => {
    const event = createEvent({
      title: 'RCD Mallorca vs. CA Osasuna',
      total_markets_count: 12,
      volume: 455_100,
      sports_sport_slug: 'soccer',
      sports_start_time: '2026-03-06T20:00:00.000Z',
      markets: [
        createMarket({
          condition_id: 'condition-mal',
          title: 'MAL',
          short_title: 'MAL',
          slug: 'mal',
          price: 0.86,
          probability: 86,
        }),
        createMarket({
          condition_id: 'condition-draw',
          title: 'DRAW',
          short_title: 'DRAW',
          slug: 'draw',
          price: 0.1,
          probability: 10,
        }),
        createMarket({
          condition_id: 'condition-osa',
          title: 'OSA',
          short_title: 'OSA',
          slug: 'osa',
          price: 0.04,
          probability: 4,
        }),
      ],
    })

    const items = buildEventFaqItems({
      event,
      siteName: 'Kuest',
      commentsCount: 1238,
    })

    expect(items[0]?.answer).toContain('with 12 possible outcomes')
    expect(items[0]?.answer).not.toContain('moneyline')
    expect(items[3]?.answer).toContain('The current frontrunner for "RCD Mallorca vs. CA Osasuna" is "MAL" at 86¢')
    expect(items[8]?.question).toBe('What does a price of 86¢ for "MAL" mean?')
    expect(items[10]?.answer).toContain('1,238 comments')
  })
})

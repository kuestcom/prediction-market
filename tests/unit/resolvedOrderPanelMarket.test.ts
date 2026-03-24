import type { Event } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  resolveResolvedOrderPanelDisplay,
  resolveResolvedOrderPanelMarket,
  resolveWinningOutcomeIndexForBinaryMarket,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/resolved-order-panel-market'
import { OUTCOME_INDEX } from '@/lib/constants'

function createMarket(overrides: Record<string, any> = {}) {
  const {
    condition: conditionOverrides,
    outcomes: outcomeOverrides,
    ...marketOverrides
  } = overrides

  return {
    ...marketOverrides,
    condition_id: marketOverrides.condition_id ?? 'condition-1',
    event_id: marketOverrides.event_id ?? 'event-1',
    question_id: marketOverrides.question_id ?? 'question-1',
    title: marketOverrides.title ?? 'Market',
    short_title: marketOverrides.short_title ?? marketOverrides.title ?? 'Market',
    slug: marketOverrides.slug ?? 'market',
    sports_market_type: marketOverrides.sports_market_type ?? null,
    sports_group_item_title: marketOverrides.sports_group_item_title ?? null,
    icon_url: marketOverrides.icon_url ?? null,
    is_active: marketOverrides.is_active ?? false,
    is_resolved: marketOverrides.is_resolved ?? true,
    block_number: marketOverrides.block_number ?? 1,
    block_timestamp: marketOverrides.block_timestamp ?? new Date().toISOString(),
    metadata: marketOverrides.metadata ?? null,
    volume_24h: marketOverrides.volume_24h ?? 0,
    volume: marketOverrides.volume ?? 0,
    created_at: marketOverrides.created_at ?? new Date().toISOString(),
    updated_at: marketOverrides.updated_at ?? new Date().toISOString(),
    price: marketOverrides.price ?? 0.5,
    probability: marketOverrides.probability ?? 50,
    outcomes: outcomeOverrides ?? [
      {
        condition_id: marketOverrides.condition_id ?? 'condition-1',
        outcome_index: OUTCOME_INDEX.YES,
        outcome_text: 'Yes',
        token_id: 'yes-token',
        is_winning_outcome: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        condition_id: marketOverrides.condition_id ?? 'condition-1',
        outcome_index: OUTCOME_INDEX.NO,
        outcome_text: 'No',
        token_id: 'no-token',
        is_winning_outcome: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    condition: {
      id: marketOverrides.condition_id ?? 'condition-1',
      oracle: 'oracle',
      question_id: marketOverrides.question_id ?? 'question-1',
      outcome_slot_count: 2,
      resolved: conditionOverrides?.resolved ?? true,
      payout_numerators: conditionOverrides?.payout_numerators,
      payout_denominator: conditionOverrides?.payout_denominator,
      resolution_price: conditionOverrides?.resolution_price,
      volume: 0,
      open_interest: 0,
      active_positions_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...conditionOverrides,
    },
  }
}

function createEvent(markets: Array<Record<string, any>>, overrides: Record<string, any> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Event',
    created_at: new Date().toISOString(),
    markets,
    sports_teams: overrides.sports_teams ?? null,
    sports_score: overrides.sports_score ?? null,
    ...overrides,
  } as unknown as Event
}

describe('resolveWinningOutcomeIndexForBinaryMarket', () => {
  it('keeps normalized condition defaults when only partial condition overrides are provided', () => {
    const market = createMarket({
      condition: { resolution_price: 1 },
    })

    expect(market.condition.id).toBe('condition-1')
    expect(market.condition.question_id).toBe('question-1')
    expect(market.condition.resolved).toBe(true)
  })

  it('uses resolution price when winning flags are unavailable', () => {
    const market = createMarket({
      condition: { resolution_price: 1 },
    })

    expect(resolveWinningOutcomeIndexForBinaryMarket(market)).toBe(OUTCOME_INDEX.YES)
  })

  it('uses payout values when winning flags are unavailable', () => {
    const market = createMarket({
      outcomes: [
        {
          condition_id: 'condition-1',
          outcome_index: OUTCOME_INDEX.YES,
          outcome_text: 'Yes',
          token_id: 'yes-token',
          is_winning_outcome: false,
          payout_value: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          condition_id: 'condition-1',
          outcome_index: OUTCOME_INDEX.NO,
          outcome_text: 'No',
          token_id: 'no-token',
          is_winning_outcome: false,
          payout_value: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })

    expect(resolveWinningOutcomeIndexForBinaryMarket(market)).toBe(OUTCOME_INDEX.YES)
  })
})

describe('resolveResolvedOrderPanelMarket', () => {
  it('uses the winning exact-score market for resolved sports cards', () => {
    const selectedMarket = createMarket({
      condition_id: 'exact-score-0-1',
      title: 'Exact Score: 0-1',
      short_title: 'Exact Score: 0-1',
      slug: 'exact-score-0-1',
      sports_market_type: 'Exact Score',
      condition: {
        resolved: true,
      },
      outcomes: [
        {
          condition_id: 'exact-score-0-1',
          outcome_index: OUTCOME_INDEX.YES,
          outcome_text: 'Yes',
          token_id: '0-1-yes',
          is_winning_outcome: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          condition_id: 'exact-score-0-1',
          outcome_index: OUTCOME_INDEX.NO,
          outcome_text: 'No',
          token_id: '0-1-no',
          is_winning_outcome: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })
    const winningMarket = createMarket({
      condition_id: 'exact-score-any-other',
      title: 'Exact Score: Any Other Score',
      short_title: 'Exact Score: Any Other Score',
      slug: 'exact-score-any-other',
      sports_market_type: 'Exact Score',
      condition: {
        resolved: true,
        resolution_price: 1,
      },
      outcomes: [
        {
          condition_id: 'exact-score-any-other',
          outcome_index: OUTCOME_INDEX.YES,
          outcome_text: 'Yes',
          token_id: 'any-other-yes',
          is_winning_outcome: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          condition_id: 'exact-score-any-other',
          outcome_index: OUTCOME_INDEX.NO,
          outcome_text: 'No',
          token_id: 'any-other-no',
          is_winning_outcome: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })
    const event = createEvent([selectedMarket, winningMarket])

    const result = resolveResolvedOrderPanelMarket({
      event,
      selectedMarket,
    })

    expect(result.market?.condition_id).toBe('exact-score-any-other')
    expect(result.market?.title).toBe('Exact Score: Any Other Score')
    expect(result.resolvedOutcomeIndex).toBe(OUTCOME_INDEX.YES)
  })

  it('keeps the selected market for non exact-score markets', () => {
    const selectedMarket = createMarket({
      condition_id: 'moneyline-home',
      title: 'Lakers',
      short_title: 'Lakers',
      slug: 'moneyline-home',
      sports_market_type: 'Moneyline',
      condition: {
        resolved: true,
        resolution_price: 0,
      },
    })
    const event = createEvent([selectedMarket])

    const result = resolveResolvedOrderPanelMarket({
      event,
      selectedMarket,
    })

    expect(result.market?.condition_id).toBe('moneyline-home')
    expect(result.resolvedOutcomeIndex).toBe(OUTCOME_INDEX.NO)
  })

  it('falls back to the final sports score for exact-score winners when market resolution flags are missing', () => {
    const selectedMarket = createMarket({
      condition_id: 'exact-score-0-1',
      title: 'Exact Score: 0-1',
      short_title: 'Exact Score: 0-1',
      slug: 'exact-score-0-1',
      sports_market_type: 'Exact Score',
      condition: {
        resolved: true,
      },
    })
    const anyOtherScoreMarket = createMarket({
      condition_id: 'exact-score-any-other',
      title: 'Exact Score: Any Other Score',
      short_title: 'Exact Score: Any Other Score',
      slug: 'exact-score-any-other',
      sports_market_type: 'Exact Score',
      sports_group_item_title: 'Any Other Score',
      condition: {
        resolved: true,
      },
    })
    const event = {
      ...createEvent([selectedMarket, anyOtherScoreMarket]),
      sports_score: '2-1',
    } as Event

    const result = resolveResolvedOrderPanelMarket({
      event,
      selectedMarket,
    })

    expect(result.market?.condition_id).toBe('exact-score-any-other')
    expect(result.resolvedOutcomeIndex).toBe(OUTCOME_INDEX.YES)
  })
})

describe('resolveResolvedOrderPanelDisplay', () => {
  const sportsTeams = [
    {
      name: 'FC Bayern Munchen',
      abbreviation: 'FCB',
      host_status: 'home',
    },
    {
      name: 'Borussia Dortmund',
      abbreviation: 'BVB',
      host_status: 'away',
    },
  ]

  it('shows the winning moneyline market even when a losing card is selected', () => {
    const losingMarket = createMarket({
      condition_id: 'moneyline-away',
      title: 'Borussia Dortmund',
      short_title: 'Borussia Dortmund',
      slug: 'moneyline-away',
      sports_market_type: 'Moneyline',
      condition: {
        resolved: true,
        resolution_price: 0,
      },
    })
    const winningMarket = createMarket({
      condition_id: 'moneyline-home',
      title: 'FC Bayern Munchen',
      short_title: 'FC Bayern Munchen',
      slug: 'moneyline-home',
      sports_market_type: 'Moneyline',
      condition: {
        resolved: true,
        resolution_price: 1,
      },
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([losingMarket, winningMarket], { sports_teams: sportsTeams }),
      selectedMarket: losingMarket,
    })

    expect(result.resolvedOutcomeIndex).toBe(OUTCOME_INDEX.YES)
    expect(result.outcomeLabel).toBe('Yes')
    expect(result.marketTitle).toBe('FC Bayern Munchen')
  })

  it('formats spread resolution with the team in outcome and line in subtitle', () => {
    const spreadMarket = createMarket({
      condition_id: 'spread-main',
      title: 'Spread 1.5',
      short_title: 'Spread 1.5',
      slug: 'spread-main',
      sports_market_type: 'Spread',
      outcomes: [
        {
          condition_id: 'spread-main',
          outcome_index: OUTCOME_INDEX.YES,
          outcome_text: 'FC Bayern Munchen -1.5',
          token_id: 'spread-home',
          is_winning_outcome: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          condition_id: 'spread-main',
          outcome_index: OUTCOME_INDEX.NO,
          outcome_text: 'Borussia Dortmund +1.5',
          token_id: 'spread-away',
          is_winning_outcome: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([spreadMarket], { sports_teams: sportsTeams }),
      selectedMarket: spreadMarket,
    })

    expect(result.outcomeLabel).toBe('FC Bayern Munchen')
    expect(result.marketTitle).toBe('FC Bayern Munchen (-1.5)')
  })

  it('formats totals resolution as over under plus line', () => {
    const totalsMarket = createMarket({
      condition_id: 'total-main',
      title: 'Over/Under 3.5',
      short_title: 'Over/Under 3.5',
      slug: 'total-main',
      sports_market_type: 'Total',
      outcomes: [
        {
          condition_id: 'total-main',
          outcome_index: OUTCOME_INDEX.YES,
          outcome_text: 'Over',
          token_id: 'total-over',
          is_winning_outcome: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          condition_id: 'total-main',
          outcome_index: OUTCOME_INDEX.NO,
          outcome_text: 'Under',
          token_id: 'total-under',
          is_winning_outcome: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([totalsMarket], { sports_teams: sportsTeams }),
      selectedMarket: totalsMarket,
    })

    expect(result.outcomeLabel).toBe('Over')
    expect(result.marketTitle).toBe('O/U 3.5')
  })

  it('keeps both teams to score subtitle stable', () => {
    const bttsMarket = createMarket({
      condition_id: 'btts-main',
      title: 'Both Teams to Score?',
      short_title: 'Both Teams to Score?',
      slug: 'btts-main',
      sports_market_type: 'Both Teams to Score',
      condition: {
        resolved: true,
        resolution_price: 1,
      },
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([bttsMarket], { sports_teams: sportsTeams }),
      selectedMarket: bttsMarket,
    })

    expect(result.outcomeLabel).toBe('Yes')
    expect(result.marketTitle).toBe('Both Teams to Score')
  })

  it('shows the winning halftime result market even when another card is selected', () => {
    const losingMarket = createMarket({
      condition_id: 'halftime-away',
      title: 'Borussia Dortmund',
      short_title: 'Borussia Dortmund',
      slug: 'halftime-away',
      sports_market_type: 'Halftime Result',
      condition: {
        resolved: true,
        resolution_price: 0,
      },
    })
    const winningMarket = createMarket({
      condition_id: 'halftime-home',
      title: 'FC Bayern Munchen',
      short_title: 'FC Bayern Munchen',
      slug: 'halftime-home',
      sports_market_type: 'Halftime Result',
      condition: {
        resolved: true,
        resolution_price: 1,
      },
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([losingMarket, winningMarket], { sports_teams: sportsTeams }),
      selectedMarket: losingMarket,
    })

    expect(result.outcomeLabel).toBe('Yes')
    expect(result.marketTitle).toBe('FC Bayern Munchen')
  })

  it('keeps exact score pinned to the winning yes market', () => {
    const selectedMarket = createMarket({
      condition_id: 'exact-score-0-1',
      title: 'Exact Score: 0-1',
      short_title: 'Exact Score: 0-1',
      slug: 'exact-score-0-1',
      sports_market_type: 'Exact Score',
      condition: {
        resolved: true,
      },
    })
    const winningMarket = createMarket({
      condition_id: 'exact-score-any-other',
      title: 'Exact Score: Any Other Score',
      short_title: 'Exact Score: Any Other Score',
      slug: 'exact-score-any-other',
      sports_market_type: 'Exact Score',
      condition: {
        resolved: true,
        resolution_price: 1,
      },
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([selectedMarket, winningMarket], {
        sports_teams: sportsTeams,
        sports_score: '2-1',
      }),
      selectedMarket,
    })

    expect(result.outcomeLabel).toBe('Yes')
    expect(result.marketTitle).toBe('Exact Score: Any Other Score')
  })

  it('infers exact score display from title when sports_market_type is missing', () => {
    const selectedMarket = createMarket({
      condition_id: 'exact-score-0-1',
      title: 'Exact Score: 0-1',
      short_title: 'Exact Score: 0-1',
      slug: 'exact-score-0-1',
      sports_market_type: null,
      condition: {
        resolved: true,
      },
    })
    const winningMarket = createMarket({
      condition_id: 'exact-score-any-other',
      title: 'Exact Score: Any Other Score',
      short_title: 'Exact Score: Any Other Score',
      slug: 'exact-score-any-other',
      sports_market_type: null,
      condition: {
        resolved: true,
        resolution_price: 1,
      },
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([selectedMarket, winningMarket], {
        sports_teams: sportsTeams,
        sports_score: '2-1',
      }),
      selectedMarket,
    })

    expect(result.outcomeLabel).toBe('Yes')
    expect(result.marketTitle).toBe('Exact Score: Any Other Score')
  })

  it('does not treat tweet market ranges as sports spread labels', () => {
    const selectedMarket = createMarket({
      condition_id: 'tweet-range-180-199',
      title: '180-199',
      short_title: '180-199',
      slug: 'elon-musk-of-tweets-march-17-march-24-180-199',
      sports_market_type: null,
      sports_group_item_title: null,
      condition: {
        resolved: true,
      },
    })

    const result = resolveResolvedOrderPanelDisplay({
      event: createEvent([selectedMarket]),
      selectedMarket,
    })

    expect(result.outcomeLabel).toBeNull()
    expect(result.marketTitle).toBe('180-199')
  })
})

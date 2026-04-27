import type { Event, Market, Outcome } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  buildEventFaqItems,
  createEventFaqTranslator,
  type EventFaqTranslatedMessages,
} from '@/lib/event-faq'

const TEST_FAQ_MESSAGES: EventFaqTranslatedMessages = {
  thisMarket: 'this market',
  thisOutcome: 'this outcome',
  yesOutcome: 'Yes',
  choiceSummary: '{label} at {price} ({probability})',
  siteAccuracySentence: ' accuracy {siteName}',
  whatIsBinaryAnswer: 'binary {eventTitle} {siteName} {probability} {price}',
  leadingOutcomeSentence: ' lead {choice}.',
  nextClosestOutcomeSentence: ' next {choice}.',
  whatIsMultiAnswer: 'multi {eventTitle} {siteName} outcomes={outcomesCount}{leaderSentence}{runnerUpSentence} price={price} probability={probability}',
  launchedOnDate: ', launched {date}',
  lowVolumeAnswer: 'low-volume {eventTitle}{launchedText}',
  sinceMarketLaunchedOnDate: ' since {date}',
  standardVolumeAnswer: 'standard-volume {eventTitle} volume={volume}{launchedText} site={siteName}',
  tradeBinaryAnswer: 'trade-binary {eventTitle}',
  tradeMultiAnswer: 'trade-multi {eventTitle} outcomes={outcomesCount}',
  currentOddsBinaryAnswer: 'current-binary {eventTitle} probability={probability} site={siteName}',
  currentFrontrunnerSentence: 'frontrunner {eventTitle} {choice} probability={probability}',
  currentPricesUpdateSentence: 'prices-update {eventTitle}',
  currentOddsMultiAnswer: 'current-multi {leaderSentence}{runnerUpSentence}',
  resolutionAnswer: 'resolution {eventTitle}',
  followAnswer: 'follow {eventTitle}',
  reliabilityAnswer: 'reliable {siteName} {volume} {eventTitle}{accuracySentence}',
  startTradingAnswer: 'start {eventTitle} {siteName}',
  priceMeaningBinaryAnswer: 'price-binary {siteName} {price} {eventTitle} {probability} {profit}',
  priceMeaningMultiAnswer: 'price-multi {siteName} {price} {selectionLabel} {eventTitle} {probability} {profit}',
  resolvedCloseAnswer: 'resolved {eventTitle}',
  openCloseAnswer: 'open {eventTitle}',
  scheduledCloseAnswer: 'scheduled {eventTitle} {closeDate}',
  activeCommentsAnswer: 'active-comments {eventTitle} {commentsCount}',
  lowCommentsAnswer: 'low-comments {eventTitle}',
  whatIsSiteAnswer: 'site {siteName} {eventTitle}',
  whatIsQuestion: 'what-is {eventTitle}',
  tradingActivityQuestion: 'activity {eventTitle} {siteName}',
  howToTradeQuestion: 'trade-question {eventTitle}',
  currentOddsQuestion: 'odds-question {eventTitle}',
  resolutionQuestion: 'resolution-question {eventTitle}',
  followQuestion: 'follow-question {eventTitle}',
  reliabilityQuestion: 'reliability-question {siteName} {eventTitle}',
  startTradingQuestion: 'start-question {eventTitle}',
  priceMeaningBinaryQuestion: 'price-question-binary {price}',
  priceMeaningMultiQuestion: 'price-question-multi {price} {selectionLabel}',
  closeTimeQuestion: 'close-question {eventTitle}',
  tradersSayingQuestion: 'comments-question {eventTitle}',
  whatIsSiteQuestion: 'site-question {siteName}',
}

const testFaqTranslator = createEventFaqTranslator(TEST_FAQ_MESSAGES)

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
      translate: testFaqTranslator,
    })

    expect(items).toHaveLength(12)
    expect(items[0]?.answer).toContain('outcomes=11')
    expect(items[0]?.answer).toContain('lead "56,000" at 100¢ (100%).')
    expect(items[1]?.answer).toContain('volume=$4.9 million')
    expect(items[3]?.answer).toContain('frontrunner "Bitcoin above ___ on March 7?" "56,000" at 100¢ (100%)')
    expect(items[8]?.question).toBe('price-question-multi 100¢ "56,000"')
    expect(items[10]?.answer).toContain('3,655')
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
      translate: testFaqTranslator,
    })

    expect(items[0]?.answer).toContain('binary "Nothing Ever Happens: 2026" Kuest 63% 63¢')
    expect(items[1]?.answer).toContain('volume=$17.2K')
    expect(items[3]?.answer).toContain('current-binary "Nothing Ever Happens: 2026" probability=63%')
    expect(items[8]?.question).toBe('price-question-binary 63¢')
    expect(items[8]?.answer).toContain('price-binary Kuest 63¢ "Nothing Ever Happens: 2026" 63% 37¢')
    expect(items[10]?.answer).toContain('16')
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
      translate: testFaqTranslator,
    })

    expect(items[1]?.answer).toContain('low-volume')
    expect(items[1]?.answer).toContain('launched')
    expect(items[6]?.answer).toContain('reliable Kuest')
    expect(items[9]?.answer).toContain('resolved')
    expect(items[10]?.answer).toContain('low-comments')
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
      translate: testFaqTranslator,
    })

    expect(items[0]?.answer).toContain('outcomes=12')
    expect(items[0]?.answer).not.toContain('moneyline')
    expect(items[3]?.answer).toContain('frontrunner "RCD Mallorca vs. CA Osasuna" "MAL" at 86¢ (86%)')
    expect(items[8]?.question).toBe('price-question-multi 86¢ "MAL"')
    expect(items[10]?.answer).toContain('1,238')
  })
})

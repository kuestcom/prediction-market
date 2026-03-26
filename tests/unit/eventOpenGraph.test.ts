import type { Event } from '@/types'
import { afterEach, describe, expect, it } from 'vitest'
import { buildEventOgImageUrl, buildEventOgImageVersion, buildEventPageUrl } from '@/lib/event-open-graph'

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'us-recession-by-end-of-2026',
    title: 'US recession by end of 2026?',
    creator: '0x123',
    icon_url: 'https://example.com/event.png',
    show_market_icons: true,
    status: 'active',
    active_markets_count: 1,
    total_markets_count: 1,
    volume: 5167.527295,
    end_date: '2027-01-31T00:00:00.000Z',
    created_at: '2026-01-30T11:18:55.000Z',
    updated_at: '2026-03-24T15:46:10.394Z',
    markets: [
      {
        condition_id: 'condition-1',
        question_id: 'question-1',
        event_id: 'event-1',
        title: 'US recession by end of 2026?',
        slug: 'us-recession-by-end-of-2026',
        icon_url: 'https://example.com/market.png',
        is_active: true,
        is_resolved: false,
        block_number: 1,
        block_timestamp: '2026-01-30T11:18:55.000Z',
        volume_24h: 0,
        volume: 5167.527295,
        created_at: '2026-01-30T11:18:55.000Z',
        updated_at: '2026-03-24T15:46:10.394Z',
        price: 0.35,
        probability: 35,
        outcomes: [
          {
            condition_id: 'condition-1',
            outcome_text: 'Yes',
            outcome_index: 0,
            token_id: 'yes-token',
            is_winning_outcome: false,
            buy_price: 0.35,
            sell_price: 0.35,
            created_at: '2026-01-30T11:18:55.000Z',
            updated_at: '2026-03-24T15:46:10.394Z',
          },
          {
            condition_id: 'condition-1',
            outcome_text: 'No',
            outcome_index: 1,
            token_id: 'no-token',
            is_winning_outcome: false,
            buy_price: 0.64,
            sell_price: 0.64,
            created_at: '2026-01-30T11:18:55.000Z',
            updated_at: '2026-03-24T15:46:10.394Z',
          },
        ],
        condition: {
          id: 'condition-1',
          oracle: 'oracle',
          question_id: 'question-1',
          outcome_slot_count: 2,
          resolved: false,
          volume: 0,
          open_interest: 0,
          active_positions_count: 0,
          created_at: '2026-01-30T11:18:55.000Z',
          updated_at: '2026-03-24T15:46:10.394Z',
        },
      },
    ],
    tags: [],
    main_tag: 'Economy',
    is_bookmarked: false,
    is_trending: true,
    ...overrides,
  }
}

describe('event open graph helpers', () => {
  const originalSiteUrl = process.env.SITE_URL

  afterEach(() => {
    if (typeof originalSiteUrl === 'string') {
      process.env.SITE_URL = originalSiteUrl
      return
    }

    delete process.env.SITE_URL
  })

  it('builds a versioned og image url with market context', () => {
    process.env.SITE_URL = 'https://demo.kuest.com'

    const imageUrl = buildEventOgImageUrl({
      eventSlug: 'us-recession-by-end-of-2026',
      locale: 'en',
      marketSlug: 'us-recession-by-end-of-2026',
      version: '2026-03-24:0.3500',
    })

    expect(imageUrl).toBe(
      'https://demo.kuest.com/api/og/event?slug=us-recession-by-end-of-2026&locale=en&market=us-recession-by-end-of-2026&v=2026-03-24%3A0.3500',
    )
  })

  it('uses the yes price in the binary market snapshot version', () => {
    const version = buildEventOgImageVersion(createEvent())

    expect(version).toContain('2026-03-24T15:46:10.394Z')
    expect(version).toContain('us-recession-by-end-of-2026')
    expect(version).toContain('0.3500')
    expect(version).toContain('5167.53')
    expect(version).not.toContain('0.6400')
  })

  it('builds the canonical event page url with locale-aware prefixes', () => {
    process.env.SITE_URL = 'https://demo.kuest.com'

    const pageUrl = buildEventPageUrl({
      eventSlug: 'us-recession-by-end-of-2026',
      locale: 'pt',
      marketSlug: null,
      route: {
        slug: 'us-recession-by-end-of-2026',
        sports_sport_slug: null,
        sports_event_slug: null,
        sports_section: null,
      },
    })

    expect(pageUrl).toBe('https://demo.kuest.com/pt/event/us-recession-by-end-of-2026')
  })
})

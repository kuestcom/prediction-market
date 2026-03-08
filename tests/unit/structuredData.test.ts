import type { Event } from '@/types'
import { afterEach, describe, expect, it } from 'vitest'
import { OUTCOME_INDEX } from '@/lib/constants'
import { buildEventStructuredData, buildSiteStructuredData } from '@/lib/structured-data'
import { createDefaultThemeSiteIdentity } from '@/lib/theme-site-identity'

const ORIGINAL_SITE_URL = process.env.SITE_URL

function createEventFixture(): Event {
  return {
    id: 'event-1',
    slug: 'will-the-iranian-regime-fall-by-june-30',
    title: 'Will the Iranian regime fall by June 30?',
    creator: '0x0000000000000000000000000000000000000001',
    icon_url: 'https://cdn.example.com/event.png',
    show_market_icons: true,
    status: 'active',
    rules: 'The market resolves to "Yes" if the regime falls by June 30, 2026.',
    active_markets_count: 1,
    total_markets_count: 1,
    volume: 11_200_000,
    start_date: '2025-12-17T23:04:55.928Z',
    end_date: '2026-06-30T00:00:00.000Z',
    created_at: '2025-12-17T23:04:55.928Z',
    updated_at: '2026-03-08T16:49:24.211Z',
    markets: [
      {
        condition_id: 'condition-1',
        question_id: 'question-1',
        event_id: 'event-1',
        title: 'Yes',
        slug: 'yes',
        short_title: 'Yes',
        icon_url: 'https://cdn.example.com/market.png',
        is_active: true,
        is_resolved: false,
        block_number: 1,
        block_timestamp: '2025-12-17T23:04:55.928Z',
        volume_24h: 681245.26,
        volume: 11_200_000,
        created_at: '2025-12-17T23:04:55.928Z',
        updated_at: '2026-03-08T16:49:24.211Z',
        price: 0.33,
        probability: 33,
        outcomes: [
          {
            condition_id: 'condition-1',
            outcome_text: 'Yes',
            outcome_index: OUTCOME_INDEX.YES,
            token_id: 'token-yes',
            is_winning_outcome: false,
            buy_price: 0.33,
            created_at: '2025-12-17T23:04:55.928Z',
            updated_at: '2025-12-17T23:04:55.928Z',
          },
          {
            condition_id: 'condition-1',
            outcome_text: 'No',
            outcome_index: OUTCOME_INDEX.NO,
            token_id: 'token-no',
            is_winning_outcome: false,
            buy_price: 0.67,
            created_at: '2025-12-17T23:04:55.928Z',
            updated_at: '2025-12-17T23:04:55.928Z',
          },
        ],
        condition: {
          id: 'condition-1',
          oracle: '0x0000000000000000000000000000000000000002',
          question_id: 'question-1',
          outcome_slot_count: 2,
          resolved: false,
          volume: 11_200_000,
          open_interest: 0,
          active_positions_count: 0,
          created_at: '2025-12-17T23:04:55.928Z',
          updated_at: '2026-03-08T16:49:24.211Z',
        },
      },
    ],
    tags: [
      { id: 1, name: 'Politics', slug: 'politics', isMainCategory: true },
      { id: 2, name: 'Iran', slug: 'iran', isMainCategory: false },
    ],
    main_tag: 'Politics',
    is_bookmarked: false,
    is_trending: true,
  }
}

describe('structuredData', () => {
  afterEach(() => {
    if (ORIGINAL_SITE_URL == null) {
      delete process.env.SITE_URL
      return
    }

    process.env.SITE_URL = ORIGINAL_SITE_URL
  })

  it('builds site structured data with sameAs social links', () => {
    process.env.SITE_URL = 'https://kuest.example'

    const site = {
      ...createDefaultThemeSiteIdentity(),
      name: 'Kuest',
      description: 'Prediction markets',
      discordLink: 'https://discord.gg/kuest',
      twitterLink: 'https://x.com/kuest',
      facebookLink: 'https://facebook.com/kuest',
      instagramLink: null,
      tiktokLink: null,
      linkedinLink: 'https://linkedin.com/company/kuest',
      youtubeLink: 'https://youtube.com/@kuest',
    }

    const structuredData = buildSiteStructuredData({
      locale: 'en',
      site,
    })

    expect(structuredData.organization.sameAs).toEqual([
      'https://discord.gg/kuest',
      'https://x.com/kuest',
      'https://facebook.com/kuest',
      'https://linkedin.com/company/kuest',
      'https://youtube.com/@kuest',
    ])
    expect(structuredData.organization.logo).toBe('https://kuest.example/images/pwa/default-icon-512.png')
    expect(structuredData.website.publisher).toEqual({ '@id': 'https://kuest.example#organization' })
  })

  it('builds event, breadcrumb, and faq structured data for event pages', () => {
    process.env.SITE_URL = 'https://kuest.example'

    const structuredData = buildEventStructuredData({
      event: createEventFixture(),
      locale: 'en',
      pagePath: '/event/will-the-iranian-regime-fall-by-june-30',
      site: {
        ...createDefaultThemeSiteIdentity(),
        name: 'Kuest',
        description: 'Prediction markets',
      },
    })

    expect(structuredData.event.url).toBe('https://kuest.example/event/will-the-iranian-regime-fall-by-june-30')
    expect(structuredData.event.eventStatus).toBe('https://schema.org/EventScheduled')
    expect(structuredData.event.offers).toMatchObject({
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD',
    })

    expect(structuredData.breadcrumbList.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Kuest',
        'item': 'https://kuest.example/',
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Politics',
        'item': 'https://kuest.example/politics',
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': 'Iran',
        'item': 'https://kuest.example/politics/iran',
      },
      {
        '@type': 'ListItem',
        'position': 4,
        'name': 'Will the Iranian regime fall by June 30?',
        'item': 'https://kuest.example/event/will-the-iranian-regime-fall-by-june-30',
      },
    ])

    expect(structuredData.faqPage).not.toBeNull()
    expect(structuredData.faqPage?.mainEntity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'Question',
          'name': 'What is the "Will the Iranian regime fall by June 30?" prediction market?',
        }),
      ]),
    )
  })

  it('omits non-http(s) URLs from structured data fields', () => {
    process.env.SITE_URL = 'https://kuest.example'

    const event = createEventFixture()
    event.icon_url = 'javascript:alert(1)'

    const eventStructuredData = buildEventStructuredData({
      event,
      locale: 'en',
      pagePath: '/event/will-the-iranian-regime-fall-by-june-30',
      site: {
        ...createDefaultThemeSiteIdentity(),
        name: 'Kuest',
        description: 'Prediction markets',
      },
    })

    const eventImages = eventStructuredData.event.image as string[]
    expect(eventImages.length).toBeGreaterThan(0)
    expect(eventImages).not.toContain('javascript:alert(1)')
    expect(eventImages.every(url => /^https?:\/\//.test(url))).toBe(true)

    const siteStructuredData = buildSiteStructuredData({
      locale: 'en',
      site: {
        ...createDefaultThemeSiteIdentity(),
        name: 'Kuest',
        description: 'Prediction markets',
        logoImageUrl: 'javascript:alert(1)',
      },
    })

    const organizationLogo = siteStructuredData.organization.logo
    expect(organizationLogo).not.toBe('javascript:alert(1)')

    if (typeof organizationLogo === 'string') {
      expect(/^https?:\/\//.test(organizationLogo)).toBe(true)
    }
  })
})

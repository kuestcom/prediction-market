import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  filterEligiblePolymarketEvents,
  getPolymarketEndDateMin,
  getPolymarketRequestLimit,
  isPolymarketEventOnKuest,
  kuestSeriesMetadata,
} from '@/lib/market-making-discovery'
import {
  buildMarketMakerQuoteInput,
  displayedCostAtomic,
  marketImportStorageKey,
  requiredSponsorBalanceAtomic,
  seriesMarketDataSummary,
  sponsorshipDurationSubtitle,
} from '@/lib/market-making-series'

describe('series market-making helpers', () => {
  it('preserves legacy event import keys and isolates series imports', () => {
    const params = {
      chainId: 80002,
      wallet: '0x00000000000000000000000000000000000000AB',
      eventSlug: 'bitcoin-up-or-down',
    }

    expect(marketImportStorageKey({ ...params, sponsorSeries: false })).toBe(
      'kuest-market-import:80002:0x00000000000000000000000000000000000000ab:bitcoin-up-or-down',
    )
    expect(marketImportStorageKey({ ...params, sponsorSeries: true })).toBe(
      'kuest-market-import:80002:0x00000000000000000000000000000000000000ab:bitcoin-up-or-down:series',
    )
  })

  it('keeps the selected event end when series sponsorship is disabled', () => {
    expect(
      buildMarketMakerQuoteInput({
        sponsor: '0x0000000000000000000000000000000000000002',
        importId: null,
        marketSource: 'polymarket',
        conditionIds: ['0x' + '11'.repeat(32)],
        depthPerSideAtomic: '1000000000',
        maxSpreadBps: 300,
        serviceEnd: 2_000_000_000,
        sponsorSeries: false,
        seriesSlug: 'btc-up-or-down-daily',
        creatorFilter: '0x0000000000000000000000000000000000000004',
      }),
    ).toMatchObject({
      marketSource: 'polymarket',
      serviceEnd: 2_000_000_000,
    })
  })

  it('builds the canonical series quote payload', () => {
    expect(
      buildMarketMakerQuoteInput({
        sponsor: '0x0000000000000000000000000000000000000002',
        importId: null,
        marketSource: 'kuest',
        conditionIds: ['0x' + '11'.repeat(32)],
        depthPerSideAtomic: '1000000000',
        maxSpreadBps: 300,
        serviceEnd: 2_000_000_000,
        sponsorSeries: true,
        seriesSlug: 'btc-up-or-down-15m',
        creatorFilter: '0x0000000000000000000000000000000000000004',
      }),
    ).toEqual({
      sponsor: '0x0000000000000000000000000000000000000002',
      marketSource: 'kuest',
      conditionIds: ['0x' + '11'.repeat(32)],
      depthPerSideAtomic: '1000000000',
      maxSpreadBps: 300,
      series: {
        enabled: true,
        seriesSlug: 'btc-up-or-down-15m',
        creatorFilter: '0x0000000000000000000000000000000000000004',
      },
    })
  })

  it('uses the backend total and never adds deployment twice', () => {
    const costs = {
      status: 'final' as const,
      campaignFundingTotalAtomic: '900000000',
      initialDeploymentFeeAtomic: '5000000',
      totalCostAtomic: '905000000',
      initialDeploymentFeePaid: false,
      initialDeploymentFeeStatus: 'final' as const,
      campaignFundingStatus: 'final' as const,
      totalCostStatus: 'final' as const,
    }
    expect(displayedCostAtomic(costs)).toBe('905000000')
    expect(displayedCostAtomic({ ...costs, initialDeploymentFeePaid: true })).toBe('900000000')
    expect(requiredSponsorBalanceAtomic(costs, true)).toBe(905000000n)
    expect(requiredSponsorBalanceAtomic({ ...costs, initialDeploymentFeePaid: true }, false)).toBe(900000000n)
  })

  it('exposes the 30-day series period and market data links', () => {
    expect(
      seriesMarketDataSummary({
        scopeKind: 'series',
        seriesSlug: 'btc-up-or-down-15m',
        links: {
          campaignApi: 'https://escrow.kuest.com/api/campaigns/1',
          seriesEventsApi: 'https://gamma-api.kuest.com/events?series_slug=btc-up-or-down-15m',
          anchorMarketApis: [
            { conditionId: '0x' + '11'.repeat(32), url: 'https://gamma-api.kuest.com/markets?condition_id=0x1' },
          ],
        },
      }),
    ).toMatchObject({
      isSeries: true,
      durationDays: 30,
      links: expect.arrayContaining(['https://escrow.kuest.com/api/campaigns/1']),
    })
  })

  it('keeps the all-renewals subtitle after the preview loads', () => {
    expect(
      sponsorshipDurationSubtitle({
        sponsorSeries: true,
        allRenewals: 'All renewals for 30 days',
        dateLabel: 'Until Sep 23, 2026',
      }),
    ).toBe('All renewals for 30 days')
  })

  it('uses the short discovery window for series without relaxing common markets', () => {
    const now = Date.parse('2026-08-24T00:00:00.000Z')
    const normalMinimumEnd = now + 3 * 24 * 60 * 60 * 1000
    const seriesMinimumEnd = now + 3 * 60 * 60 * 1000
    const eligible = filterEligiblePolymarketEvents(
      [
        {
          id: 'series',
          seriesSlug: 'btc-up-or-down-15m',
          markets: [{ conditionId: 'series-condition', endDate: new Date(now + 4 * 60 * 60 * 1000).toISOString() }],
        },
        {
          id: 'common-too-soon',
          markets: [{ conditionId: 'common-soon', endDate: new Date(now + 4 * 60 * 60 * 1000).toISOString() }],
        },
        {
          id: 'common',
          markets: [{ conditionId: 'common-condition', endDate: new Date(normalMinimumEnd + 60_000).toISOString() }],
        },
      ],
      now,
      normalMinimumEnd,
      seriesMinimumEnd,
      18,
    )

    expect(eligible.map((event) => event.id)).toEqual(['series', 'common'])
    expect(getPolymarketEndDateMin('', normalMinimumEnd, seriesMinimumEnd)).toBe(
      new Date(seriesMinimumEnd).toISOString(),
    )
    expect(getPolymarketRequestLimit('', 18)).toBe(36)
  })

  it('recognizes a valid existing series mapping without deployment', () => {
    expect(
      isPolymarketEventOnKuest(
        [{ conditionId: '0xABC' }, { conditionId: '0xDEF' }],
        new Map([
          ['0xabc', 'kuest-a'],
          ['0xdef', 'kuest-b'],
        ]),
      ),
    ).toBe(true)
  })

  it('passes Kuest recurrence through to the discovery item metadata', () => {
    expect(kuestSeriesMetadata(' BTC-UP-OR-DOWN-15M ', ' 15m ')).toEqual({
      seriesSlug: 'btc-up-or-down-15m',
      seriesRecurrence: '15m',
    })
  })

  it('has no empty translation values', () => {
    const messagesDirectory = join(process.cwd(), 'src/i18n/messages')
    const emptyValues: string[] = []
    function visit(value: unknown, path: string) {
      if (typeof value === 'string') {
        if (value.length === 0) {
          emptyValues.push(path)
        }
        return
      }
      if (!value || typeof value !== 'object') {
        return
      }
      for (const [key, child] of Object.entries(value)) {
        visit(child, `${path}.${key}`)
      }
    }

    for (const filename of readdirSync(messagesDirectory).filter((name) => name.endsWith('.json'))) {
      visit(JSON.parse(readFileSync(join(messagesDirectory, filename), 'utf8')), filename)
    }

    expect(emptyValues).toEqual([])
  })
})

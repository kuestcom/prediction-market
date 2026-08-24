import { describe, expect, it } from 'vitest'

import {
  buildMarketMakerQuoteInput,
  displayedCostAtomic,
  requiredSponsorBalanceAtomic,
  seriesMarketDataSummary,
} from '@/lib/market-making-series'

describe('series market-making helpers', () => {
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
})

import { describe, expect, it } from 'vitest'
import {
  isCryptoEvent,
  matchesCryptoCadenceRoute,
  resolveCryptoCadenceEventPresentation,
  resolveCryptoCadenceRouteSlug,
  resolveCryptoEventAsset,
} from '@/lib/crypto-cadence-event'

const BASE_BTC_EVENT = {
  title: 'Bitcoin Up or Down - July 28, 8AM ET',
  main_tag: 'Crypto',
  series_recurrence: 'daily',
  tags: [],
}

describe('crypto cadence event presentation', () => {
  it.each([
    {
      routeSlug: '5M',
      seriesSlug: 'btc-up-or-down-5m',
      endDate: '2026-07-28T12:05:00.000Z',
      title: 'BTC Up or Down 5m',
      subtitle: 'July 28, 8-8:05AM ET',
    },
    {
      routeSlug: '15M',
      seriesSlug: 'btc-up-or-down-15m',
      endDate: '2026-07-28T12:15:00.000Z',
      title: 'BTC Up or Down 15m',
      subtitle: 'July 28, 8-8:15AM ET',
    },
    {
      routeSlug: 'hourly',
      seriesSlug: 'btc-up-or-down-hourly',
      endDate: '2026-07-28T13:00:00.000Z',
      title: 'BTC Up or Down Hourly',
      subtitle: 'July 28, 8-9AM ET',
    },
    {
      routeSlug: '4hour',
      seriesSlug: 'bitcoin-up-or-down-4h',
      endDate: '2026-07-28T16:00:00.000Z',
      title: 'BTC Up or Down 4h',
      subtitle: 'July 28, 8AM-12PM ET',
    },
    {
      routeSlug: 'daily',
      seriesSlug: 'btc-up-or-down-daily',
      endDate: '2026-07-29T04:00:00.000Z',
      title: 'BTC Up or Down Daily',
      subtitle: 'July 28',
    },
  ])('uses $seriesSlug when upstream recurrence says daily', ({
    endDate,
    routeSlug,
    seriesSlug,
    subtitle,
    title,
  }) => {
    const event = {
      ...BASE_BTC_EVENT,
      end_date: endDate,
      series_slug: seriesSlug,
    }

    expect(resolveCryptoCadenceRouteSlug(event)).toBe(routeSlug)
    expect(matchesCryptoCadenceRoute(event, routeSlug)).toBe(true)
    expect(resolveCryptoCadenceEventPresentation(event)).toEqual({ title, subtitle })
    expect(resolveCryptoEventAsset(event)).toMatchObject({
      name: 'Bitcoin',
      slug: 'bitcoin',
    })
  })

  it('does not replace non-cadence crypto event titles', () => {
    expect(resolveCryptoCadenceEventPresentation({
      ...BASE_BTC_EVENT,
      end_date: '2026-07-28T20:00:00.000Z',
      series_recurrence: 'weekly',
      series_slug: 'btc-up-or-down-weekly',
    })).toBeNull()
  })

  it('recognizes crypto events from their tags', () => {
    expect(isCryptoEvent({
      main_tag: 'Markets',
      tags: [{ slug: 'crypto', name: 'Cryptocurrency' }],
    })).toBe(true)
  })
})

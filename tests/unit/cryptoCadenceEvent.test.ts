import { describe, expect, it } from 'vitest'

import {
  CRYPTO_CADENCE_ROUTES,
  isCryptoEvent,
  matchesCryptoCadenceRoute,
  resolveCryptoCadenceEventPresentation,
  resolveCryptoCadenceEventTitle,
  resolveCryptoCadenceRelatedEventTitle,
  resolveCryptoCadenceRelatedLabel,
  resolveCryptoCadenceRouteSlug,
  resolveCryptoCadenceSidebarLabel,
  resolveCryptoEventAsset,
  resolveCryptoEventAssetName,
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
      subtitle: null,
    },
  ])('uses $seriesSlug when upstream recurrence says daily', ({ endDate, routeSlug, seriesSlug, subtitle, title }) => {
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
    expect(
      resolveCryptoCadenceEventPresentation({
        ...BASE_BTC_EVENT,
        end_date: '2026-07-28T20:00:00.000Z',
        series_recurrence: 'weekly',
        series_slug: 'btc-up-or-down-weekly',
      }),
    ).toBeNull()
  })

  it('localizes cadence titles and time windows', () => {
    const event = {
      ...BASE_BTC_EVENT,
      end_date: '2026-07-28T12:15:00.000Z',
      series_slug: 'btc-up-or-down-15m',
    }

    expect(resolveCryptoCadenceEventPresentation(event, 'pt')).toEqual({
      title: 'BTC sobe ou desce 15m',
      subtitle: '28 de julho, 08:00 – 08:15 ET',
    })
    expect(
      resolveCryptoCadenceEventTitle(
        {
          ...event,
          series_slug: 'btc-up-or-down-hourly',
        },
        'pt',
      ),
    ).toBe('BTC sobe ou desce Por hora')
    expect(
      resolveCryptoCadenceEventTitle(
        {
          ...event,
          series_slug: 'btc-up-or-down-daily',
        },
        'ja',
      ),
    ).toBe('BTCは上がる？下がる？ デイリー')
  })

  it('includes both New York dates when a cadence window crosses midnight', () => {
    const event = {
      ...BASE_BTC_EVENT,
      end_date: '2026-07-29T06:00:00.000Z',
      series_slug: 'btc-up-or-down-4h',
    }

    expect(resolveCryptoCadenceEventPresentation(event)).toEqual({
      title: 'BTC Up or Down 4h',
      subtitle: 'July 28, 10PM-July 29, 2AM ET',
    })
    expect(resolveCryptoCadenceEventPresentation(event, 'pt')).toEqual({
      title: 'BTC sobe ou desce 4h',
      subtitle: '28 de julho às 22:00 – 29 de julho às 02:00 ET',
    })
  })

  it('uses compact localized titles for 5 and 15-minute related rows', () => {
    expect(
      resolveCryptoCadenceRelatedEventTitle({
        ...BASE_BTC_EVENT,
        end_date: '2026-07-28T12:15:00.000Z',
        series_slug: 'btc-up-or-down-15m',
      }),
    ).toBe('BTC Up or Down - 15m')

    expect(
      resolveCryptoCadenceRelatedEventTitle(
        {
          ...BASE_BTC_EVENT,
          end_date: '2026-07-28T12:05:00.000Z',
          series_slug: 'btc-up-or-down-5m',
        },
        'pt',
      ),
    ).toBe('BTC sobe ou desce - 5m')

    expect(
      resolveCryptoCadenceRelatedEventTitle({
        ...BASE_BTC_EVENT,
        end_date: '2026-07-28T13:00:00.000Z',
        series_slug: 'btc-up-or-down-hourly',
      }),
    ).toBeNull()
  })

  it('localizes generated cadence navigation labels', () => {
    expect(
      resolveCryptoCadenceSidebarLabel(
        {
          cadence: '15m',
          durationMinutes: 15,
          recurrenceValues: ['15m', '15min'],
          routeSlug: '15M',
          seriesTokens: ['15m'],
          sidebarLabel: '15 Min',
          titleSuffix: '15m',
        },
        'pt',
      ),
    ).toBe('15 minutos')
    expect(
      resolveCryptoCadenceSidebarLabel(
        {
          cadence: 'daily',
          durationMinutes: 24 * 60,
          recurrenceValues: ['daily', '1d'],
          routeSlug: 'daily',
          seriesTokens: ['daily', '1d'],
          sidebarLabel: 'Daily',
          titleSuffix: 'Daily',
        },
        'zh',
      ),
    ).toBe('每日')
  })

  it('uses the exact related-event cadence tab labels', () => {
    expect(CRYPTO_CADENCE_ROUTES.map((route) => resolveCryptoCadenceRelatedLabel(route, 'en'))).toEqual([
      '5 Min',
      '15 Min',
      '1 Hour',
      '4 Hour',
      'Daily',
    ])
  })

  it('uses the translated coin tag name in supporting UI', () => {
    const event = {
      ...BASE_BTC_EVENT,
      end_date: '2026-07-28T12:15:00.000Z',
      series_slug: 'btc-up-or-down-15m',
      tags: [{ slug: 'bitcoin', name: '比特币' }],
    }

    expect(resolveCryptoEventAssetName(event)).toBe('比特币')
  })

  it('preserves uppercase ticker-style asset names', () => {
    expect(
      resolveCryptoEventAssetName({
        ...BASE_BTC_EVENT,
        title: 'hype Up or Down',
        end_date: '2026-07-28T12:15:00.000Z',
        series_slug: 'hype-up-or-down-15m',
        tags: [{ slug: 'hype', name: 'hype' }],
      }),
    ).toBe('HYPE')
  })

  it('recognizes crypto events from their tags', () => {
    expect(
      isCryptoEvent({
        main_tag: 'Markets',
        tags: [{ slug: 'crypto', name: 'Cryptocurrency' }],
      }),
    ).toBe(true)
  })
})

import { getHomeEventsNextPageParam, getHomeEventsQueryKey } from '@/lib/home-events-query'

describe('home events query helpers', () => {
  const filters = {
    tag: 'crypto',
    mainTag: 'crypto',
    search: '',
    bookmarked: false,
    frequency: 'all',
    sortBy: 'volume_24h',
    status: 'active',
    hideSports: false,
    hideCrypto: false,
    hideEarnings: false,
  } as const

  it('builds a cache key shared by the home feed and prefetcher', () => {
    expect(
      getHomeEventsQueryKey({
        filters,
        locale: 'en',
        queryUserScope: 'guest',
        homeFeedClockState: 'clock-ready',
      }),
    ).toEqual([
      'events',
      'crypto',
      'crypto',
      '',
      false,
      'all',
      'volume_24h',
      'active',
      false,
      false,
      false,
      'en',
      'guest',
      'clock-ready',
    ])
  })

  it('uses the loaded event count as the next page offset', () => {
    expect(
      getHomeEventsNextPageParam({ events: [{ id: 'event-2' } as any], hasMore: true }, [
        { events: [{ id: 'event-1' } as any], hasMore: true },
        { events: [{ id: 'event-2' } as any], hasMore: true },
      ]),
    ).toBe(2)

    expect(getHomeEventsNextPageParam({ events: [], hasMore: false }, [])).toBeUndefined()
  })
})

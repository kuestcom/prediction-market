import { act, render } from '@testing-library/react'
import EventsGrid from '@/app/[locale]/(platform)/(home)/_components/EventsGrid'

const mocks = vi.hoisted(() => ({
  eventsStaticGrid: vi.fn(),
  filterHomeEvents: vi.fn((events: any[], _options?: any) => events),
  refetch: vi.fn().mockResolvedValue(undefined),
  useCurrentTimestamp: vi.fn(),
  useInfiniteQuery: vi.fn(),
  useUser: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: Symbol('keepPreviousData'),
  useInfiniteQuery: (options: any) => mocks.useInfiniteQuery(options),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventCardSkeleton', () => ({
  default: () => <div data-testid="event-card-skeleton" />,
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton', () => ({
  default: () => <div data-testid="events-grid-skeleton" />,
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventsStaticGrid', () => ({
  default: (props: any) => {
    mocks.eventsStaticGrid(props)
    return <div data-testid="events-static-grid" />
  },
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/EventsEmptyState', () => ({
  default: () => <div data-testid="events-empty-state" />,
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_hooks/useEventLastTrades', () => ({
  useEventLastTrades: () => ({}),
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices', () => ({
  useEventMarketQuotes: () => ({}),
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory', () => ({
  buildMarketTargets: () => [],
}))

vi.mock('@/hooks/useColumns', () => ({
  useColumns: () => 3,
}))

vi.mock('@/hooks/useCurrentTimestamp', () => ({
  useCurrentTimestamp: (...args: any[]) => mocks.useCurrentTimestamp(...args),
}))

vi.mock('@/lib/home-events', async () => {
  const actual = await vi.importActual<typeof import('@/lib/home-events')>('@/lib/home-events')

  return {
    ...actual,
    filterHomeEvents: (events: any[], options?: any) => mocks.filterHomeEvents(events, options),
  }
})

vi.mock('@/lib/market-chance', async () => {
  const actual = await vi.importActual<typeof import('@/lib/market-chance')>('@/lib/market-chance')

  return {
    ...actual,
    resolveDisplayPrice: () => null,
  }
})

vi.mock('@/stores/useUser', () => ({
  useUser: () => mocks.useUser(),
}))

describe('eventsGrid', () => {
  function createEvent(overrides: Record<string, any>) {
    return {
      id: 'event-1',
      slug: 'event-1',
      title: 'Event 1',
      status: 'active',
      created_at: '2026-03-16T12:00:00.000Z',
      updated_at: '2026-03-16T12:00:00.000Z',
      tags: [],
      markets: [{ is_resolved: false, condition: { resolved: false } }],
      is_bookmarked: false,
      ...overrides,
    } as any
  }

  beforeEach(() => {
    mocks.eventsStaticGrid.mockClear()
    mocks.filterHomeEvents.mockClear()
    mocks.refetch.mockClear()
    mocks.useCurrentTimestamp.mockReset()
    mocks.useInfiniteQuery.mockReset()
    mocks.useUser.mockReset()
    mocks.useCurrentTimestamp.mockReturnValue(Date.parse('2026-03-16T12:00:00.000Z'))
    mocks.useUser.mockReturnValue(null)
    mocks.useInfiniteQuery.mockImplementation(() => ({
      status: 'success',
      data: { pages: [[]] },
      dataUpdatedAt: 0,
      isFetching: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isPending: false,
      refetch: mocks.refetch,
    }))
  })

  it('uses a user-scoped query key without forcing an extra refetch when auth hydrates', async () => {
    const filters = {
      tag: 'trending',
      mainTag: 'trending',
      search: '',
      bookmarked: false,
      frequency: 'all',
      sortBy: 'volume_24h',
      status: 'active',
      hideSports: false,
      hideCrypto: false,
      hideEarnings: false,
    } as const

    const { rerender } = render(
      <EventsGrid
        filters={filters}
        initialEvents={[]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(mocks.useInfiniteQuery.mock.calls.at(-1)?.[0].queryKey).toContain('guest')
    expect(mocks.useInfiniteQuery.mock.calls.at(-1)?.[0].queryKey).not.toContain('public')

    mocks.useUser.mockReturnValue({ id: 'user-1' })

    rerender(
      <EventsGrid
        filters={filters}
        initialEvents={[]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(mocks.useInfiniteQuery.mock.calls.at(-1)?.[0].queryKey).toContain('user-1')
    expect(mocks.refetch).not.toHaveBeenCalled()
  })

  it('does not hydrate a user-scoped query with guest initial data', () => {
    mocks.useUser.mockReturnValue({ id: 'user-1' })

    render(
      <EventsGrid
        filters={{
          tag: 'trending',
          mainTag: 'trending',
          search: '',
          bookmarked: false,
          frequency: 'all',
          sortBy: 'volume_24h',
          status: 'active',
          hideSports: false,
          hideCrypto: false,
          hideEarnings: false,
        }}
        initialEvents={[{ id: 'event-1' } as any]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(mocks.useInfiniteQuery.mock.calls.at(-1)?.[0].initialData).toBeUndefined()
  })

  it('does not render unbookmarked placeholder rows in resolved bookmarked feeds', () => {
    mocks.useUser.mockReturnValue({ id: 'user-1' })
    const bookmarkedEvent = { id: 'bookmarked-event', is_bookmarked: true }
    mocks.useInfiniteQuery.mockImplementation(() => ({
      status: 'success',
      data: {
        pages: [[
          { id: 'unbookmarked-event', is_bookmarked: false },
          bookmarkedEvent,
        ]],
      },
      dataUpdatedAt: 0,
      isFetching: true,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isPending: false,
      refetch: mocks.refetch,
    }))

    render(
      <EventsGrid
        filters={{
          tag: 'trending',
          mainTag: 'trending',
          search: '',
          bookmarked: true,
          frequency: 'all',
          sortBy: 'volume_24h',
          status: 'resolved',
          hideSports: false,
          hideCrypto: false,
          hideEarnings: false,
        }}
        initialEvents={[]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(mocks.eventsStaticGrid.mock.calls.at(-1)?.[0].events).toEqual([bookmarkedEvent])
  })

  it('renders only resolved weather events for the resolved weather filter', () => {
    const activeWeatherEvent = createEvent({
      id: 'active-weather',
      slug: 'active-weather',
      title: 'Active weather',
      status: 'active',
      tags: [{ slug: 'weather' }],
      markets: [{ is_resolved: false, condition: { resolved: false } }],
    })
    const resolvedWeatherEvent = createEvent({
      id: 'resolved-weather',
      slug: 'resolved-weather',
      title: 'Resolved weather',
      status: 'resolved',
      tags: [{ slug: 'weather' }],
      markets: [{ is_resolved: true, condition: { resolved: true } }],
    })
    const resolvedFinanceEvent = createEvent({
      id: 'resolved-finance',
      slug: 'resolved-finance',
      title: 'Resolved finance',
      status: 'resolved',
      tags: [{ slug: 'finance' }],
      markets: [{ is_resolved: true, condition: { resolved: true } }],
    })

    mocks.useInfiniteQuery.mockImplementation(() => ({
      status: 'success',
      data: { pages: [[activeWeatherEvent, resolvedWeatherEvent, resolvedFinanceEvent]] },
      dataUpdatedAt: 1,
      isFetching: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isPending: false,
      isPlaceholderData: false,
      refetch: mocks.refetch,
    }))

    render(
      <EventsGrid
        filters={{
          tag: 'weather',
          mainTag: 'weather',
          search: '',
          bookmarked: false,
          frequency: 'all',
          sortBy: 'volume_24h',
          status: 'resolved',
          hideSports: false,
          hideCrypto: false,
          hideEarnings: false,
        }}
        initialEvents={[]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="weather"
        routeTag="weather"
      />,
    )

    expect(mocks.eventsStaticGrid.mock.calls.at(-1)?.[0].events).toEqual([resolvedWeatherEvent])
  })

  it('does not render stale active weather placeholder data while resolved weather loads', () => {
    const activeWeatherEvent = createEvent({
      id: 'active-weather',
      slug: 'active-weather',
      title: 'Active weather',
      status: 'active',
      tags: [{ slug: 'weather' }],
      markets: [{ is_resolved: false, condition: { resolved: false } }],
    })

    mocks.useInfiniteQuery.mockImplementation(() => ({
      status: 'success',
      data: { pages: [[activeWeatherEvent]] },
      dataUpdatedAt: 0,
      isFetching: true,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isPending: false,
      isPlaceholderData: true,
      refetch: mocks.refetch,
    }))

    const view = render(
      <EventsGrid
        filters={{
          tag: 'weather',
          mainTag: 'weather',
          search: '',
          bookmarked: false,
          frequency: 'all',
          sortBy: 'volume_24h',
          status: 'resolved',
          hideSports: false,
          hideCrypto: false,
          hideEarnings: false,
        }}
        initialEvents={[]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="weather"
        routeTag="weather"
      />,
    )

    expect(view.getByTestId('events-grid-skeleton')).toBeTruthy()
    expect(mocks.eventsStaticGrid).not.toHaveBeenCalled()
  })

  it('keeps server-rendered events visible while a logged-in query is still hydrating', () => {
    mocks.useUser.mockReturnValue({ id: 'user-1' })
    mocks.useInfiniteQuery.mockImplementation(() => ({
      status: 'pending',
      data: undefined,
      dataUpdatedAt: 0,
      isFetching: true,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isPending: true,
      refetch: mocks.refetch,
    }))

    const view = render(
      <EventsGrid
        filters={{
          tag: 'trending',
          mainTag: 'trending',
          search: '',
          bookmarked: false,
          frequency: 'all',
          sortBy: 'volume_24h',
          status: 'active',
          hideSports: false,
          hideCrypto: false,
          hideEarnings: false,
        }}
        initialEvents={[{ id: 'event-1' } as any]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(view.getByTestId('events-static-grid')).toBeTruthy()
    expect(view.queryByTestId('events-grid-skeleton')).toBeNull()
  })

  it('does not refetch active feeds when hydration only advances the clock by a small amount', async () => {
    const initialCurrentTimestamp = Date.parse('2026-03-16T12:00:00.000Z')
    const filters = {
      tag: 'trending',
      mainTag: 'trending',
      search: '',
      bookmarked: false,
      frequency: 'all',
      sortBy: 'volume_24h',
      status: 'active',
      hideSports: false,
      hideCrypto: false,
      hideEarnings: false,
    } as const

    const { rerender } = render(
      <EventsGrid
        filters={filters}
        initialEvents={[]}
        initialCurrentTimestamp={initialCurrentTimestamp}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    mocks.useCurrentTimestamp.mockReturnValue(initialCurrentTimestamp + 500)

    await act(async () => {
      rerender(
        <EventsGrid
          filters={filters}
          initialEvents={[]}
          initialCurrentTimestamp={initialCurrentTimestamp}
          routeMainTag="trending"
          routeTag="trending"
        />,
      )
    })

    expect(mocks.refetch).not.toHaveBeenCalled()
  })

  it('starts a fresh active feed query when the client timestamp hydrates from null', async () => {
    const filters = {
      tag: 'trending',
      mainTag: 'trending',
      search: '',
      bookmarked: false,
      frequency: 'all',
      sortBy: 'volume_24h',
      status: 'active',
      hideSports: false,
      hideCrypto: false,
      hideEarnings: false,
    } as const

    const hydratedTimestamp = Date.parse('2026-03-16T12:00:00.000Z')
    mocks.useCurrentTimestamp.mockReturnValueOnce(null).mockReturnValue(hydratedTimestamp)

    const { rerender } = render(
      <EventsGrid
        filters={filters}
        initialEvents={[{ id: 'server-seeded-event' } as any]}
        initialCurrentTimestamp={null}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    const pendingClockOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0]
    expect(pendingClockOptions.queryKey).toContain('clock-pending')
    expect(pendingClockOptions.enabled).toBe(false)
    expect(pendingClockOptions.initialData).toEqual({
      pages: [[{ id: 'server-seeded-event' }]],
      pageParams: [0],
    })

    await act(async () => {
      rerender(
        <EventsGrid
          filters={filters}
          initialEvents={[{ id: 'server-seeded-event' } as any]}
          initialCurrentTimestamp={null}
          routeMainTag="trending"
          routeTag="trending"
        />,
      )
    })

    const readyClockOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0]
    expect(mocks.refetch).not.toHaveBeenCalled()
    expect(readyClockOptions.queryKey).toContain('clock-ready')
    expect(readyClockOptions.enabled).toBe(true)
    expect(readyClockOptions.initialData).toBeUndefined()
    expect(readyClockOptions.refetchInterval).toBe(60_000)
  })

  it('hydrates new route initial data with newest-first sort', async () => {
    const newestLowVolumeEvent = {
      id: 'newer-low-volume-event',
      created_at: '2026-03-16T12:00:00.000Z',
      volume_24h: 1,
    }
    const olderHighVolumeEvent = {
      id: 'older-high-volume-event',
      created_at: '2026-03-15T12:00:00.000Z',
      volume_24h: 10_000,
    }
    const newestFirstEvents = [
      newestLowVolumeEvent,
      olderHighVolumeEvent,
    ] as any[]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      render(
        <EventsGrid
          filters={{
            tag: 'new',
            mainTag: 'new',
            search: '',
            bookmarked: false,
            frequency: 'all',
            sortBy: 'created_at',
            status: 'active',
            hideSports: false,
            hideCrypto: false,
            hideEarnings: false,
          }}
          initialEvents={newestFirstEvents}
          initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
          routeMainTag="new"
          routeTag="new"
        />,
      )

      const queryOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0]
      expect(queryOptions.queryKey).toContain('created_at')
      expect(queryOptions.queryKey).not.toContain('volume_24h')
      expect(queryOptions.initialData).toEqual({
        pages: [newestFirstEvents],
        pageParams: [0],
      })
      expect(queryOptions.initialData.pages[0].map((event: any) => event.id)).toEqual([
        'newer-low-volume-event',
        'older-high-volume-event',
      ])

      await queryOptions.queryFn({ pageParam: 0 })

      const requestUrl = fetchMock.mock.calls[0]?.[0] as string
      expect(requestUrl).toContain('tag=new')
      expect(requestUrl).toContain('sort=created_at')
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('passes the selected sort to the events API request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <EventsGrid
        filters={{
          tag: 'trending',
          mainTag: 'trending',
          search: '',
          bookmarked: false,
          frequency: 'all',
          sortBy: 'volume',
          status: 'active',
          hideSports: false,
          hideCrypto: false,
          hideEarnings: false,
        }}
        initialEvents={[]}
        initialCurrentTimestamp={Date.parse('2026-03-16T12:00:00.000Z')}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    const queryOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0]
    expect(queryOptions.queryKey).toContain('volume')

    await queryOptions.queryFn({ pageParam: 0 })

    const requestUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(requestUrl).toContain('sort=volume')

    vi.unstubAllGlobals()
  })
})

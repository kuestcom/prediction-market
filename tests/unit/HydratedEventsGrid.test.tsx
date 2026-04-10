import { act, render } from '@testing-library/react'
import HydratedEventsGrid from '@/app/[locale]/(platform)/(home)/_components/HydratedEventsGrid'

const mocks = vi.hoisted(() => ({
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
  default: () => <div data-testid="events-static-grid" />,
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

describe('hydratedEventsGrid', () => {
  beforeEach(() => {
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
      status: 'active',
      hideSports: false,
      hideCrypto: false,
      hideEarnings: false,
    } as const

    const { rerender } = render(
      <HydratedEventsGrid
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
      <HydratedEventsGrid
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
      <HydratedEventsGrid
        filters={{
          tag: 'trending',
          mainTag: 'trending',
          search: '',
          bookmarked: false,
          frequency: 'all',
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
      <HydratedEventsGrid
        filters={{
          tag: 'trending',
          mainTag: 'trending',
          search: '',
          bookmarked: false,
          frequency: 'all',
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
      status: 'active',
      hideSports: false,
      hideCrypto: false,
      hideEarnings: false,
    } as const

    const { rerender } = render(
      <HydratedEventsGrid
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
        <HydratedEventsGrid
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

  it('refetches once when the client timestamp hydrates from null', async () => {
    const filters = {
      tag: 'trending',
      mainTag: 'trending',
      search: '',
      bookmarked: false,
      frequency: 'all',
      status: 'active',
      hideSports: false,
      hideCrypto: false,
      hideEarnings: false,
    } as const

    const hydratedTimestamp = Date.parse('2026-03-16T12:00:00.000Z')
    mocks.useCurrentTimestamp.mockReturnValueOnce(null).mockReturnValue(hydratedTimestamp)

    const { rerender } = render(
      <HydratedEventsGrid
        filters={filters}
        initialEvents={[]}
        initialCurrentTimestamp={null}
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    await act(async () => {
      rerender(
        <HydratedEventsGrid
          filters={filters}
          initialEvents={[]}
          initialCurrentTimestamp={null}
          routeMainTag="trending"
          routeTag="trending"
        />,
      )
    })

    expect(mocks.refetch).toHaveBeenCalledTimes(1)
  })
})

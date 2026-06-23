import { act, fireEvent, render, screen } from '@testing-library/react'
import PredictionResultsClient from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsClient'

const mocks = vi.hoisted(() => {
  let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null

  return {
    fetchNextPage: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn(),
    useInfiniteQuery: vi.fn(),
    useSearchParams: vi.fn(),
    getIntersectionCallback: () => intersectionCallback,
    setIntersectionCallback: (callback: typeof intersectionCallback) => {
      intersectionCallback = callback
    },
  }
})

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (options: any) => mocks.useInfiniteQuery(options),
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => ({ isConnected: true }),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
  useLocale: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.useSearchParams(),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, prefetch: _prefetch, ...props }: any) => <a href={href} {...props}>{children}</a>,
  usePathname: () => '/predictions/test',
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock('@/components/EventIconImage', () => ({
  default: function MockEventIconImage({ alt }: { alt: string }) {
    return <span>{alt}</span>
  },
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({ open: vi.fn() }),
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_hooks/useCommentMetrics', () => ({
  useCommentMetrics: () => ({
    data: { comments_count: 3417 },
  }),
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: any) => <div>{children}</div>,
  DrawerTrigger: ({ children }: any) => children,
  DrawerContent: () => null,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <div>{children}</div>,
}))

describe('predictionResultsClient', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.fetchNextPage.mockClear()
    mocks.replace.mockClear()
    mocks.useInfiniteQuery.mockReset()
    mocks.useSearchParams.mockReset()
    mocks.setIntersectionCallback(null)
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved&_sort=volume'))
    mocks.useInfiniteQuery.mockImplementation(() => ({
      data: {
        pages: [[
          {
            id: 'event-1',
            slug: 'test-future-president',
            title: 'Test future president?',
            icon_url: '/icon.png',
            status: 'active',
            volume: 120000,
            end_date: '2026-04-01T00:00:00.000Z',
            tags: [{ id: 1, name: 'Politics', slug: 'politics', isMainCategory: true }],
            markets: [{
              condition: { resolved: false },
              condition_id: 'c1',
              is_resolved: false,
              probability: 51,
              title: 'Yes',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: true,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
    }))

    globalThis.IntersectionObserver = class {
      constructor(callback: any) {
        mocks.setIntersectionCallback(callback)
      }

      observe() {}

      disconnect() {}

      unobserve() {}
    } as any
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces search navigation and preserves active filters in the url', async () => {
    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="volume"
        initialStatus="resolved"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    fireEvent.change(screen.getByTestId('prediction-search-input'), {
      target: { value: 'future bets' },
    })

    await act(async () => {
      vi.advanceTimersByTime(299)
    })

    expect(mocks.replace).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    const [href, options] = mocks.replace.mock.calls.at(-1) ?? []
    expect(href).toContain('/predictions/future-bets')
    expect(href).toContain('_status=resolved')
    expect(href).toContain('_sort=volume')
    expect(options).toEqual({ scroll: false })
  })

  it('does not replace the route on mount when the current filtered url is already in sync', () => {
    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="volume"
        initialStatus="resolved"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('keeps direct visits on the clean default predictions url until the user changes a filter', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams(''))

    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="trending"
        initialStatus="active"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('renders the all status filter last and only appends it after the user selects it', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams(''))

    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="trending"
        initialStatus="active"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    const statusButtons = Array.from(
      screen.getByTestId('prediction-status-active').parentElement?.children ?? [],
    ).map(button => button.getAttribute('data-testid'))

    expect(statusButtons).toEqual([
      'prediction-status-active',
      'prediction-status-resolved',
      'prediction-status-all',
    ])

    fireEvent.click(screen.getByTestId('prediction-status-all'))

    const [href, options] = mocks.replace.mock.calls.at(-1) ?? []
    expect(href).toBe('/predictions/test?_status=all')
    expect(options).toEqual({ scroll: false })
  })

  it('keeps an active status selection while the resolved url replacement is pending', async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved&_sort=volume'))

    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="volume"
        initialStatus="resolved"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('prediction-status-active'))
    })

    expect(screen.getByTestId('prediction-status-active')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('prediction-status-resolved')).toHaveAttribute('aria-pressed', 'false')

    const [href, options] = mocks.replace.mock.calls.at(-1) ?? []
    expect(href).toBe('/predictions/test?_sort=volume')
    expect(options).toEqual({ scroll: false })
  })

  it('shows only resolved events on resolved category pages even when the fetched dataset is combined', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation(() => ({
      data: {
        pages: [[
          {
            id: 'event-active',
            slug: 'meta-active',
            title: 'Meta active event',
            icon_url: '/icon.png',
            status: 'active',
            volume: 120000,
            end_date: '2026-04-01T00:00:00.000Z',
            tags: [{ id: 1, name: 'Meta', slug: 'meta', isMainCategory: true }],
            markets: [{
              condition: { resolved: false },
              condition_id: 'c1',
              is_resolved: false,
              probability: 51,
              title: 'Yes',
            }],
          },
          {
            id: 'event-resolved',
            slug: 'meta-resolved',
            title: 'Meta resolved event',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 90000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            tags: [{ id: 1, name: 'Meta', slug: 'meta', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'c2',
              is_resolved: true,
              probability: 100,
              title: 'Yes',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
    }))

    render(
      <PredictionResultsClient
        displayLabel="Meta"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="meta"
        initialQuery=""
        initialSort="trending"
        initialStatus="resolved"
        routeMainTag="meta"
        routeTag="meta"
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Meta active event' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Meta resolved event' })).toBeInTheDocument()
  })

  it('filters stale resolved search rows by the prediction query before rendering', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation((options: any) => ({
      data: {
        pages: [[
          {
            id: 'event-meta',
            slug: 'meta-up-or-down',
            title: 'Meta up or down?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 90000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            tags: [{ id: 1, name: 'Finance', slug: 'finance', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'meta',
              is_resolved: true,
              probability: 100,
              title: 'Yes',
            }],
          },
          {
            id: 'event-paulo',
            slug: 'highest-temperature-in-sao-paulo-on-march-24-2026',
            title: 'Highest temperature in Sao Paulo on March 24?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 70000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            tags: [{ id: 2, name: 'Weather', slug: 'weather', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'paulo-temp',
              is_resolved: true,
              probability: 100,
              title: 'Yes',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
      queryFn: options.queryFn,
    }))

    try {
      render(
        <PredictionResultsClient
          displayLabel="Paulo"
          initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
          initialEvents={[]}
          initialInputValue="paulo"
          initialQuery="paulo"
          initialSort="trending"
          initialStatus="resolved"
          routeMainTag="trending"
          routeTag="trending"
        />,
      )

      expect(screen.queryByRole('heading', { name: 'Meta up or down?' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Highest temperature in Sao Paulo on March 24?' })).toBeInTheDocument()

      const queryOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0]
      await queryOptions.queryFn({ pageParam: 0 })

      const requestUrl = fetchMock.mock.calls[0]?.[0] as string
      expect(requestUrl).toContain('/api/predictions/events?')
      expect(requestUrl).toContain('search=paulo')
      expect(requestUrl).toContain('status=resolved')
      expect(requestUrl).not.toContain('homeFeed=')
      expect(requestUrl).not.toContain('sort=')
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('filters stale resolved search rows for non-Latin prediction queries', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation(() => ({
      data: {
        pages: [[
          {
            id: 'event-meta',
            slug: 'meta-up-or-down',
            title: 'Meta up or down?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 90000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            tags: [{ id: 1, name: 'Finance', slug: 'finance', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'meta',
              is_resolved: true,
              probability: 100,
              title: 'Yes',
            }],
          },
          {
            id: 'event-tokyo',
            slug: 'highest-temperature-in-tokyo-on-march-24-2026',
            title: '東京の最高気温は?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 70000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            tags: [{ id: 2, name: 'Weather', slug: 'weather', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'tokyo-temp',
              is_resolved: true,
              probability: 100,
              title: 'Yes',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
    }))

    render(
      <PredictionResultsClient
        displayLabel="東京"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="東京"
        initialQuery="東京"
        initialSort="trending"
        initialStatus="resolved"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Meta up or down?' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '東京の最高気温は?' })).toBeInTheDocument()
  })

  it('shows only bookmarked matching rows when the prediction bookmark filter is active', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation((options: any) => ({
      data: {
        pages: [[
          {
            id: 'event-paulo-june-8',
            slug: 'highest-temperature-in-sao-paulo-on-june-8-2026',
            title: 'Highest temperature in Sao Paulo on June 8?',
            icon_url: '/icon.png',
            is_bookmarked: false,
            status: 'resolved',
            volume: 50000,
            resolved_at: '2026-06-08T00:00:00.000Z',
            end_date: '2026-06-08T00:00:00.000Z',
            tags: [{ id: 2, name: 'Weather', slug: 'weather', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'paulo-temp-june-8',
              is_resolved: true,
              probability: 100,
              title: 'Yes',
            }],
          },
          {
            id: 'event-paulo-june-9',
            slug: 'highest-temperature-in-sao-paulo-on-june-9-2026',
            title: 'Highest temperature in Sao Paulo on June 9?',
            icon_url: '/icon.png',
            is_bookmarked: true,
            status: 'resolved',
            volume: 70000,
            resolved_at: '2026-06-09T00:00:00.000Z',
            end_date: '2026-06-09T00:00:00.000Z',
            tags: [{ id: 2, name: 'Weather', slug: 'weather', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'paulo-temp-june-9',
              is_resolved: true,
              probability: 100,
              title: 'Yes',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
      queryFn: options.queryFn,
    }))

    try {
      render(
        <PredictionResultsClient
          displayLabel="Paulo"
          initialCurrentTimestamp={Date.parse('2026-06-10T12:00:00.000Z')}
          initialEvents={[]}
          initialInputValue="paulo"
          initialQuery="paulo"
          initialSort="trending"
          initialStatus="resolved"
          routeMainTag="trending"
          routeTag="trending"
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getAllByTestId('prediction-bookmark-filter')[0])
      })

      expect(screen.queryByRole('heading', { name: 'Highest temperature in Sao Paulo on June 8?' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Highest temperature in Sao Paulo on June 9?' })).toBeInTheDocument()

      const queryOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0]
      await queryOptions.queryFn({ pageParam: 0 })

      const requestUrl = fetchMock.mock.calls[0]?.[0] as string
      expect(requestUrl).toContain('/api/predictions/events?')
      expect(requestUrl).toContain('bookmarked=true')
      expect(requestUrl).toContain('search=paulo')
      expect(requestUrl).toContain('status=resolved')
      expect(requestUrl).not.toContain('homeFeed=')
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('shows the winning outcome label on resolved single-market rows', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation(() => ({
      data: {
        pages: [[
          {
            id: 'event-single-resolved',
            slug: 'meta-single-resolved',
            title: 'Meta up or down?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 90000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            total_markets_count: 1,
            tags: [{ id: 1, name: 'Meta', slug: 'meta', isMainCategory: true }],
            markets: [{
              condition: { resolved: true, resolution_price: 1 },
              condition_id: 'single-market',
              is_resolved: true,
              outcomes: [
                { outcome_index: 0, outcome_text: 'Up' },
                { outcome_index: 1, outcome_text: 'Down' },
              ],
              probability: 100,
              short_title: 'Up or Down',
              title: 'Up or Down',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
    }))

    render(
      <PredictionResultsClient
        displayLabel="Meta"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="meta"
        initialQuery=""
        initialSort="trending"
        initialStatus="resolved"
        routeMainTag="meta"
        routeTag="meta"
      />,
    )

    expect(screen.getByText('Up')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('uses the no-outcome badge styling when the resolved winner is no', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation(() => ({
      data: {
        pages: [[
          {
            id: 'event-single-no-resolved',
            slug: 'meta-single-no-resolved',
            title: 'Meta down?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 90000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            total_markets_count: 1,
            tags: [{ id: 1, name: 'Meta', slug: 'meta', isMainCategory: true }],
            markets: [{
              condition: { resolved: true, resolution_price: 0 },
              condition_id: 'single-market-no',
              is_resolved: true,
              outcomes: [
                { outcome_index: 0, outcome_text: 'Up' },
                { outcome_index: 1, outcome_text: 'Down' },
              ],
              probability: 0,
              short_title: 'Up or Down',
              title: 'Up or Down',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
    }))

    render(
      <PredictionResultsClient
        displayLabel="Meta"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="meta"
        initialQuery=""
        initialSort="trending"
        initialStatus="resolved"
        routeMainTag="meta"
        routeTag="meta"
      />,
    )

    expect(screen.getByText('Down')).toBeInTheDocument()
    expect(screen.getByTestId('prediction-result-resolved-badge')).toHaveAttribute('data-outcome', 'no')
    expect(screen.getByTestId('prediction-result-resolved-badge')).toHaveClass('bg-no')
  })

  it('uses a neutral badge when the resolved winner cannot be determined', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation(() => ({
      data: {
        pages: [[
          {
            id: 'event-single-unknown-resolved',
            slug: 'meta-single-unknown-resolved',
            title: 'Meta unresolved winner?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 90000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            total_markets_count: 1,
            tags: [{ id: 1, name: 'Meta', slug: 'meta', isMainCategory: true }],
            markets: [{
              condition: { resolved: true },
              condition_id: 'single-market-unknown',
              is_resolved: true,
              outcomes: [
                { outcome_index: 0, outcome_text: 'Yes' },
                { outcome_index: 1, outcome_text: 'No' },
              ],
              probability: 50,
              short_title: 'Unclear winner',
              title: 'Unclear winner',
            }],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
    }))

    render(
      <PredictionResultsClient
        displayLabel="Meta"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="meta"
        initialQuery=""
        initialSort="trending"
        initialStatus="resolved"
        routeMainTag="meta"
        routeTag="meta"
      />,
    )

    expect(screen.getByText('Unclear winner')).toBeInTheDocument()
    expect(screen.getByTestId('prediction-result-resolved-badge')).toHaveAttribute('data-outcome', 'unknown')
    expect(screen.getByTestId('prediction-result-resolved-badge')).toHaveClass('bg-muted')
    expect(screen.getByTestId('prediction-result-resolved-badge')).not.toHaveClass('bg-yes')
  })

  it('shows the winning market label on resolved multi-market rows', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('_status=resolved'))
    mocks.useInfiniteQuery.mockImplementation(() => ({
      data: {
        pages: [[
          {
            id: 'event-multi-resolved',
            slug: 'meta-multi-resolved',
            title: 'Meta closing range?',
            icon_url: '/icon.png',
            status: 'resolved',
            volume: 90000,
            resolved_at: '2026-03-24T00:00:00.000Z',
            end_date: '2026-03-24T00:00:00.000Z',
            total_markets_count: 2,
            tags: [{ id: 1, name: 'Meta', slug: 'meta', isMainCategory: true }],
            markets: [
              {
                condition: { resolved: true, resolution_price: 0 },
                condition_id: 'range-loser',
                is_resolved: true,
                outcomes: [
                  { outcome_index: 0, outcome_text: 'Yes' },
                  { outcome_index: 1, outcome_text: 'No' },
                ],
                probability: 0,
                short_title: '260-279',
                title: '260-279',
              },
              {
                condition: { resolved: true, resolution_price: 1 },
                condition_id: 'range-winner',
                is_resolved: true,
                outcomes: [
                  { outcome_index: 0, outcome_text: 'Yes' },
                  { outcome_index: 1, outcome_text: 'No' },
                ],
                probability: 100,
                short_title: '280-299',
                title: '280-299',
              },
            ],
          },
        ]],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPending: false,
    }))

    render(
      <PredictionResultsClient
        displayLabel="Meta"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="meta"
        initialQuery=""
        initialSort="trending"
        initialStatus="resolved"
        routeMainTag="meta"
        routeTag="meta"
      />,
    )

    expect(screen.getByText('280-299')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('renders the desktop aside shell and the mobile drawer trigger', () => {
    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="volume"
        initialStatus="resolved"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    expect(screen.getByTestId('prediction-filters-aside')).toHaveClass('hidden')
    expect(screen.getByTestId('prediction-filters-drawer-trigger')).toBeInTheDocument()
  })

  it('renders the event title inside a link to the event page', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams(''))

    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="trending"
        initialStatus="active"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    const titleLink = screen.getByRole('heading', { name: 'Test future president?' }).closest('a')
    expect(titleLink).not.toBeNull()
    expect(titleLink).toHaveAttribute('href', expect.stringContaining('/event/test-future-president'))
  })

  it('fetches the next page when the infinite-scroll sentinel intersects', async () => {
    render(
      <PredictionResultsClient
        displayLabel="Test"
        initialCurrentTimestamp={Date.parse('2026-03-25T12:00:00.000Z')}
        initialEvents={[]}
        initialInputValue="test"
        initialQuery="test"
        initialSort="volume"
        initialStatus="resolved"
        routeMainTag="trending"
        routeTag="trending"
      />,
    )

    await act(async () => {
      mocks.getIntersectionCallback()?.([{ isIntersecting: true }] as any)
    })

    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1)
  })
})

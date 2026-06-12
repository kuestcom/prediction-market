import type { Event } from '@/types'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'

const mocks = vi.hoisted(() => ({
  getBookmarkStatusAction: vi.fn(),
  getQueriesData: vi.fn(),
  open: vi.fn(),
  removeQueries: vi.fn(),
  setQueryData: vi.fn(),
  toggleBookmarkAction: vi.fn(),
  useUser: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueriesData: mocks.getQueriesData,
    removeQueries: mocks.removeQueries,
    setQueryData: mocks.setQueryData,
  }),
}))

vi.mock('@/app/[locale]/(platform)/_actions/bookmark', () => ({
  getBookmarkStatusAction: (...args: any[]) => mocks.getBookmarkStatusAction(...args),
  toggleBookmarkAction: (...args: any[]) => mocks.toggleBookmarkAction(...args),
}))

vi.mock('@/components/ui/button', () => ({
  Button: function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>
  },
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({
    open: mocks.open,
  }),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => mocks.useUser(),
}))

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Event 1',
    creator: 'Creator',
    icon_url: '',
    show_market_icons: false,
    status: 'active',
    active_markets_count: 1,
    total_markets_count: 1,
    volume: 0,
    end_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    markets: [],
    tags: [],
    main_tag: 'trending',
    is_bookmarked: false,
    is_trending: false,
    ...overrides,
  }
}

function createDeferredPromise<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: resolvePromise,
  }
}

describe('eventBookmark', () => {
  beforeEach(() => {
    mocks.getBookmarkStatusAction.mockReset()
    mocks.getQueriesData.mockReset()
    mocks.open.mockReset()
    mocks.removeQueries.mockReset()
    mocks.setQueryData.mockReset()
    mocks.toggleBookmarkAction.mockReset()
    mocks.useUser.mockReset()
    mocks.getQueriesData.mockReturnValue([])
    mocks.toggleBookmarkAction.mockResolvedValue({
      data: {
        isBookmarked: true,
        userId: 'user-1',
      },
      error: null,
    })
    mocks.useUser.mockReturnValue({ id: 'user-1' })
  })

  it('refreshes bookmark state on mount by default', async () => {
    mocks.getBookmarkStatusAction.mockResolvedValueOnce({ data: true, error: null })

    render(
      <EventBookmark
        event={createEvent()}
      />,
    )

    await waitFor(() => {
      expect(mocks.getBookmarkStatusAction).toHaveBeenCalledWith('event-1')
    })

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('skips the mount refresh when disabled by list cards', async () => {
    render(
      <EventBookmark
        event={createEvent()}
        refreshStatusOnMount={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })

    expect(mocks.getBookmarkStatusAction).not.toHaveBeenCalled()
  })

  it('toggles for an authenticated user without relying on wallet connection state', async () => {
    render(
      <EventBookmark
        event={createEvent()}
        refreshStatusOnMount={false}
      />,
    )

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mocks.open).not.toHaveBeenCalled()
    })

    expect(mocks.toggleBookmarkAction).toHaveBeenCalledWith('event-1')
    await waitFor(() => {
      expect(mocks.removeQueries).toHaveBeenCalledWith(expect.objectContaining({ type: 'inactive' }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('reconciles to the persisted bookmark state from the server action', async () => {
    const deferredToggle = createDeferredPromise<{
      data: {
        isBookmarked: boolean
        userId: string
      }
      error: null
    }>()

    mocks.toggleBookmarkAction.mockReturnValueOnce(deferredToggle.promise)

    render(
      <EventBookmark
        event={createEvent()}
        refreshStatusOnMount={false}
      />,
    )

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mocks.toggleBookmarkAction).toHaveBeenCalledWith('event-1')
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })

    deferredToggle.resolve({
      data: {
        isBookmarked: false,
        userId: 'user-1',
      },
      error: null,
    })

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('only rewrites the acting user event caches', async () => {
    const homeResolvedUserKey = ['events', 'trending', 'trending', '', false, 'all', 'volume_24h', 'resolved', false, false, false, 'en', 'user-1', 'clock-static']
    const homeResolvedBookmarkedUserKey = ['events', 'trending', 'trending', '', true, 'all', 'volume_24h', 'resolved', false, false, false, 'en', 'user-1', 'clock-static']
    const homeResolvedGuestKey = ['events', 'trending', 'trending', '', false, 'all', 'volume_24h', 'resolved', false, false, false, 'en', 'guest', 'clock-static']
    const sportsUserKey = ['events', '', false, 'all', 'active', false, false, false, 'sports', 'en', 'sports', 'sports', 'user-1', null, null]
    const cachedQueries = [
      [homeResolvedUserKey, { pages: [[{ id: 'event-1', is_bookmarked: false }]], pageParams: [0] }],
      [homeResolvedBookmarkedUserKey, { pages: [[{ id: 'event-1', is_bookmarked: false }]], pageParams: [0] }],
      [homeResolvedGuestKey, { pages: [[{ id: 'event-1', is_bookmarked: false }]], pageParams: [0] }],
      [sportsUserKey, { pages: [[{ id: 'event-1', is_bookmarked: false }]], pageParams: [0] }],
    ] as const

    mocks.getQueriesData.mockImplementation(({ predicate }: { predicate?: (query: { queryKey: readonly unknown[] }) => boolean }) => (
      cachedQueries.filter(([queryKey]) => predicate?.({ queryKey }) ?? true)
    ))

    render(
      <EventBookmark
        event={createEvent()}
        refreshStatusOnMount={false}
      />,
    )

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mocks.setQueryData).toHaveBeenCalledTimes(3)
    })

    expect(mocks.setQueryData.mock.calls.map(call => call[0])).toEqual([
      homeResolvedUserKey,
      homeResolvedBookmarkedUserKey,
      sportsUserKey,
    ])
  })

  it('removes unbookmarked events from bookmarked-only home caches', async () => {
    const homeResolvedUserKey = ['events', 'trending', 'trending', '', false, 'all', 'volume_24h', 'resolved', false, false, false, 'en', 'user-1', 'clock-static']
    const homeResolvedBookmarkedUserKey = ['events', 'trending', 'trending', '', true, 'all', 'volume_24h', 'resolved', false, false, false, 'en', 'user-1', 'clock-static']
    const cachedQueries = [
      [homeResolvedUserKey, { pages: [[{ id: 'event-1', is_bookmarked: true }]], pageParams: [0] }],
      [homeResolvedBookmarkedUserKey, { pages: [[{ id: 'event-1', is_bookmarked: true }]], pageParams: [0] }],
    ] as const

    mocks.getQueriesData.mockImplementation(({ predicate }: { predicate?: (query: { queryKey: readonly unknown[] }) => boolean }) => (
      cachedQueries.filter(([queryKey]) => predicate?.({ queryKey }) ?? true)
    ))
    mocks.toggleBookmarkAction.mockResolvedValueOnce({
      data: {
        isBookmarked: false,
        userId: 'user-1',
      },
      error: null,
    })

    render(
      <EventBookmark
        event={createEvent({ is_bookmarked: true })}
        refreshStatusOnMount={false}
      />,
    )

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mocks.setQueryData).toHaveBeenCalledTimes(2)
    })

    expect(mocks.setQueryData).toHaveBeenNthCalledWith(1, homeResolvedUserKey, {
      pages: [[{ id: 'event-1', is_bookmarked: false }]],
      pageParams: [0],
    })
    expect(mocks.setQueryData).toHaveBeenNthCalledWith(2, homeResolvedBookmarkedUserKey, {
      pages: [[]],
      pageParams: [0],
    })
  })
})

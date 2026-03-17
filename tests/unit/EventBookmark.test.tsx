import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'

const mocks = vi.hoisted(() => ({
  getBookmarkStatusAction: vi.fn(),
  getQueriesData: vi.fn(),
  open: vi.fn(),
  setQueryData: vi.fn(),
  toggleBookmarkAction: vi.fn(),
  useUser: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueriesData: mocks.getQueriesData,
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

describe('eventBookmark', () => {
  beforeEach(() => {
    mocks.getBookmarkStatusAction.mockReset()
    mocks.getQueriesData.mockReset()
    mocks.open.mockReset()
    mocks.setQueryData.mockReset()
    mocks.toggleBookmarkAction.mockReset()
    mocks.useUser.mockReset()
    mocks.getQueriesData.mockReturnValue([])
    mocks.toggleBookmarkAction.mockResolvedValue({ data: null, error: null })
    mocks.useUser.mockReturnValue({ id: 'user-1' })
  })

  it('refreshes bookmark state on mount by default', async () => {
    mocks.getBookmarkStatusAction.mockResolvedValueOnce({ data: true, error: null })

    render(
      <EventBookmark
        event={{
          id: 'event-1',
          is_bookmarked: false,
        }}
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
        event={{
          id: 'event-1',
          is_bookmarked: false,
        }}
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
        event={{
          id: 'event-1',
          is_bookmarked: false,
        }}
        refreshStatusOnMount={false}
      />,
    )

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mocks.open).not.toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })
})

import { render } from '@testing-library/react'
import EventCardFooter from '@/app/[locale]/(platform)/(home)/_components/EventCardFooter'

const mocks = vi.hoisted(() => ({
  eventBookmark: vi.fn(),
}))

vi.mock('lucide-react', () => ({
  Repeat: () => <svg data-testid="repeat-icon" />,
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark', () => ({
  default: function MockEventBookmark(props: any) {
    mocks.eventBookmark(props)
    return <span data-testid="event-bookmark" />
  },
}))

vi.mock('@/components/ui/new-badge', () => ({
  NewBadge: () => <span data-testid="new-badge">New</span>,
}))

vi.mock('@/lib/formatters', () => ({
  formatVolume: () => '1.2K',
}))

describe('eventCardFooter', () => {
  beforeEach(() => {
    mocks.eventBookmark.mockReset()
  })

  it('disables bookmark status refresh for feed cards', () => {
    render(
      <EventCardFooter
        event={{
          id: 'event-1',
          status: 'active',
          is_bookmarked: false,
          volume: 1200,
          series_recurrence: null,
        } as any}
        shouldShowNewBadge={false}
        showLiveBadge={false}
        resolvedVolume={1200}
      />,
    )

    expect(mocks.eventBookmark).toHaveBeenCalledWith(expect.objectContaining({
      refreshStatusOnMount: false,
    }))
  })
})

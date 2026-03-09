import { render, screen } from '@testing-library/react'
import EventsStaticGrid, {
  getStaticGridColumnsClassName,
} from '@/app/[locale]/(platform)/(home)/_components/EventsStaticGrid'

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventCard', () => ({
  default: function MockEventCard({ event }: { event: { title: string } }) {
    return <article>{event.title}</article>
  },
}))

describe('eventsStaticGrid', () => {
  it('uses responsive columns when no max column limit is provided', () => {
    expect(getStaticGridColumnsClassName()).toBe('grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
  })

  it('renders server-visible event cards with the expected column cap', () => {
    const events = [
      {
        id: '1',
        title: 'First event',
      },
      {
        id: '2',
        title: 'Second event',
      },
    ] as any[]

    const { container } = render(
      <EventsStaticGrid
        events={events}
        priceOverridesByMarket={{}}
        maxColumns={3}
      />,
    )

    expect(screen.getByText('First event')).toBeInTheDocument()
    expect(screen.getByText('Second event')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
  })
})

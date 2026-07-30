import type { ComponentProps, ReactNode } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import EventSeriesPills from '@/app/[locale]/(platform)/event/[slug]/_components/EventSeriesPills'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function createSeriesEvent(
  id: string,
  endDate: string,
  overrides: Partial<NonNullable<ComponentProps<typeof EventSeriesPills>['seriesEvents']>[number]> = {},
): NonNullable<ComponentProps<typeof EventSeriesPills>['seriesEvents']>[number] {
  return {
    id,
    slug: id,
    status: 'active',
    end_date: endDate,
    resolved_at: null,
    created_at: '2026-07-28T00:00:00.000Z',
    ...overrides,
  }
}

describe('eventSeriesPills', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T12:47:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows two 5-minute event pills and moves later events into More', () => {
    render(
      <EventSeriesPills
        currentEventSlug="event-1"
        seriesEvents={[
          createSeriesEvent('past-event', '2026-07-28T12:35:00.000Z', {
            status: 'resolved',
            resolved_at: '2026-07-28T12:35:00.000Z',
            resolved_direction: 'up',
          }),
          createSeriesEvent('event-1', '2026-07-28T12:50:00.000Z'),
          createSeriesEvent('event-2', '2026-07-28T12:55:00.000Z'),
          createSeriesEvent('event-3', '2026-07-28T13:00:00.000Z'),
          createSeriesEvent('event-4', '2026-07-28T13:05:00.000Z'),
        ]}
        tradingWindowMs={5 * 60 * 1000}
        variant="live"
      />,
    )

    expect(screen.getByRole('link', { name: '8:35 AM' })).toBeInTheDocument()
    expect(screen.getByText('8:50 AM')).toBeInTheDocument()
    expect(screen.getByText('8:55 AM')).toBeInTheDocument()
    expect(screen.queryByText('9:00 AM')).not.toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(screen.getByText('9:00 AM ET')).toBeInTheDocument()
    expect(screen.getByText('9:05 AM ET')).toBeInTheDocument()
  })

  it.each([
    ['1-hour', 60 * 60 * 1000, '2026-07-28T13:00:00.000Z'],
    ['4-hour', 4 * 60 * 60 * 1000, '2026-07-28T16:00:00.000Z'],
  ])('moves later %s events into More', (_, tradingWindowMs, firstEndDate) => {
    const firstEndTimestamp = Date.parse(firstEndDate)

    render(
      <EventSeriesPills
        currentEventSlug="event-1"
        seriesEvents={[0, 1, 2, 3].map((offset) =>
          createSeriesEvent(
            `event-${offset + 1}`,
            new Date(firstEndTimestamp + offset * tradingWindowMs).toISOString(),
          ),
        )}
        tradingWindowMs={tradingWindowMs}
        variant="live"
      />,
    )

    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })

  it('shows past 4-hour results with ET time labels', () => {
    render(
      <EventSeriesPills
        currentEventSlug="event-1"
        seriesEvents={[
          createSeriesEvent('past-event', '2026-07-28T12:00:00.000Z', {
            status: 'resolved',
            resolved_at: '2026-07-28T12:00:00.000Z',
            resolved_direction: 'down',
          }),
          createSeriesEvent('event-1', '2026-07-28T16:00:00.000Z'),
        ]}
        tradingWindowMs={4 * 60 * 60 * 1000}
        variant="live"
      />,
    )

    expect(screen.getByRole('link', { name: '8 AM' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Jul 28' })).not.toBeInTheDocument()
  })

  it.each([5, 15])('shows both future pills without More for %i-minute events', (minutes) => {
    const tradingWindowMs = minutes * 60 * 1000
    const firstEndTimestamp = Date.parse('2026-07-28T12:50:00.000Z')

    render(
      <EventSeriesPills
        currentEventSlug="event-1"
        seriesEvents={[0, 1, 2].map((offset) =>
          createSeriesEvent(
            `event-${offset + 1}`,
            new Date(firstEndTimestamp + offset * tradingWindowMs).toISOString(),
          ),
        )}
        tradingWindowMs={tradingWindowMs}
        variant="live"
      />,
    )

    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})

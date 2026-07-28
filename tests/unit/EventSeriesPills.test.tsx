import type { ComponentProps, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import EventSeriesPills from '@/app/[locale]/(platform)/event/[slug]/_components/EventSeriesPills'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode, href: string }) => (
    <a href={href} {...props}>{children}</a>
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
})

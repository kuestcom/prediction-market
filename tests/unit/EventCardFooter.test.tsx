import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import EventCardFooter from '@/app/[locale]/(platform)/(home)/_components/EventCardFooter'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  eventBookmark: mock(),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce((label, [key, value]) => label.replace(`{${key}}`, String(value)), message),
}))

void mock.module('lucide-react', () => ({
  Repeat: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="repeat-icon" {...props} />,
}))

void mock.module('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark', () => ({
  default: function MockEventBookmark(props: any) {
    mocks.eventBookmark(props)
    return <span data-testid="event-bookmark" />
  },
}))

void mock.module('@/components/ui/new-badge', () => ({
  NewBadge: () => <span data-testid="new-badge">New</span>,
}))

void mock.module('@/lib/formatters', () => ({
  formatVolume: () => '1.2K',
}))

describe('eventCardFooter', () => {
  beforeEach(() => {
    mocks.eventBookmark.mockReset()
  })

  it('disables bookmark status refresh for feed cards', () => {
    render(
      <EventCardFooter
        event={
          {
            id: 'event-1',
            status: 'active',
            is_bookmarked: false,
            volume: 1200,
            series_recurrence: null,
          } as any
        }
        shouldShowNewBadge={false}
        showLiveBadge={false}
        resolvedVolume={1200}
      />,
    )

    expect(mocks.eventBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshStatusOnMount: false,
      }),
    )
  })

  it.each([
    ['daily', 'Daily'],
    ['weekly', 'Weekly'],
    ['monthly', 'Monthly'],
  ])('shows only the recurrence icon for %s cards', (seriesRecurrence, visibleLabel) => {
    render(
      <EventCardFooter
        event={
          {
            id: 'event-1',
            status: 'active',
            is_bookmarked: false,
            volume: 1200,
            series_recurrence: seriesRecurrence,
          } as any
        }
        shouldShowNewBadge={false}
        showLiveBadge={false}
        resolvedVolume={1200}
      />,
    )

    expect(screen.getByTestId('repeat-icon')).toHaveAttribute('aria-label', 'Recurring event')
    expect(screen.queryByText(visibleLabel)).not.toBeInTheDocument()
  })

  it('replaces live crypto volume and recurrence with a linked coin name', () => {
    render(
      <EventCardFooter
        event={
          {
            id: 'event-1',
            title: 'Bitcoin Up or Down - July 28, 8AM ET',
            status: 'active',
            is_bookmarked: false,
            volume: 1200,
            series_recurrence: 'daily',
            series_slug: 'btc-up-or-down-hourly',
            main_tag: 'Crypto',
            tags: [],
          } as any
        }
        shouldShowNewBadge={false}
        showLiveBadge
        resolvedVolume={1200}
      />,
    )

    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('·')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bitcoin' })).toHaveAttribute('href', '/crypto/bitcoin')
    expect(screen.queryByText('1.2K Vol.')).not.toBeInTheDocument()
    expect(screen.queryByText('Daily')).not.toBeInTheDocument()
    expect(screen.queryByTestId('repeat-icon')).not.toBeInTheDocument()
  })

  it('prioritizes Live over New for newly created live crypto cards', () => {
    render(
      <EventCardFooter
        event={
          {
            id: 'event-1',
            title: 'Bitcoin Up or Down',
            status: 'active',
            is_bookmarked: false,
            volume: 0,
            series_recurrence: 'hourly',
            series_slug: 'btc-up-or-down-hourly',
            main_tag: 'Crypto',
            tags: [],
          } as any
        }
        shouldShowNewBadge
        showLiveBadge
        resolvedVolume={0}
      />,
    )

    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.queryByTestId('new-badge')).not.toBeInTheDocument()
    expect(screen.queryByText('1.2K Vol.')).not.toBeInTheDocument()
  })

  it('uses the translated coin tag name for live crypto cards', () => {
    render(
      <EventCardFooter
        event={
          {
            id: 'event-1',
            title: 'Bitcoin会上涨还是下跌 — 7月28日 08:15 ET',
            status: 'active',
            is_bookmarked: false,
            volume: 1200,
            series_recurrence: '15m',
            series_slug: 'btc-up-or-down-15m',
            main_tag: '加密货币',
            tags: [
              { slug: 'crypto', name: '加密货币' },
              { slug: 'bitcoin', name: '比特币' },
            ],
          } as any
        }
        shouldShowNewBadge={false}
        showLiveBadge
        resolvedVolume={1200}
      />,
    )

    expect(screen.getByRole('link', { name: '比特币' })).toHaveAttribute('href', '/crypto/bitcoin')
  })

  it.each([
    ['HYPE', 'hype-up-or-down-15m', '/crypto/hype', [{ slug: 'hype', name: 'hype' }]],
    ['Dogecoin', 'dogecoin-up-or-down-4h', '/crypto/dogecoin', []],
  ])(
    'replaces incorrect daily recurrence with the linked coin for active %s cadence cards',
    (title, seriesSlug, categoryHref, tags) => {
      render(
        <EventCardFooter
          event={
            {
              id: 'event-1',
              title: `${title} Up or Down`,
              status: 'active',
              is_bookmarked: false,
              volume: 1200,
              series_recurrence: 'daily',
              series_slug: seriesSlug,
              main_tag: 'Crypto',
              tags,
            } as any
          }
          shouldShowNewBadge={false}
          showLiveBadge={false}
          resolvedVolume={1200}
        />,
      )

      expect(screen.queryByText('Daily')).not.toBeInTheDocument()
      expect(screen.queryByTestId('repeat-icon')).not.toBeInTheDocument()
      expect(screen.getByText('·')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: title })).toHaveAttribute('href', categoryHref)
    },
  )
})

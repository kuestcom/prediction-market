import type { AnchorHTMLAttributes } from 'react'
import { render } from '@testing-library/react'
import EventCardSportsMoneyline from '@/app/[locale]/(platform)/(home)/_components/EventCardSportsMoneyline'

vi.mock('next/image', () => ({
  default: function MockImage({ fill: _fill, ...props }: any) {
    return <img {...props} />
  },
}))

vi.mock('@/components/IntentPrefetchLink', () => ({
  default: function MockIntentPrefetchLink({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark', () => ({
  default: function MockEventBookmark() {
    return <span data-testid="event-bookmark" />
  },
}))

vi.mock('@/lib/events-routing', () => ({
  resolveEventOutcomePath: (_event: unknown, payload: { conditionId: string, outcomeIndex: number }) =>
    `/event/${payload.conditionId}/${payload.outcomeIndex}`,
}))

describe('eventCardSportsMoneyline', () => {
  it('uses primary fallback colors when team metadata does not include colors', () => {
    const event = {
      status: 'open',
      volume: 12345,
      sports_sport_slug: 'ufc',
      sports_start_time: '2026-03-14T23:00:00.000Z',
      markets: [
        {
          condition_id: 'ufc-main-event',
          slug: 'ufc-main-event',
        },
      ],
    } as any

    const model = {
      team1: {
        name: 'Manel',
        abbreviation: 'MAN',
        color: null,
        logoUrl: null,
        hostStatus: 'home',
      },
      team2: {
        name: 'Bolanos',
        abbreviation: 'BOL',
        color: null,
        logoUrl: null,
        hostStatus: 'away',
      },
      team1Button: {
        conditionId: 'ufc-main-event',
        outcomeIndex: 0,
        label: 'MAN',
        tone: 'team1',
        color: null,
      },
      team2Button: {
        conditionId: 'ufc-main-event',
        outcomeIndex: 1,
        label: 'BOL',
        tone: 'team2',
        color: null,
      },
    } as any

    const { container } = render(
      <EventCardSportsMoneyline
        event={event}
        model={model}
        getDisplayChance={() => 61}
        currentTimestamp={Date.parse('2026-03-12T12:00:00.000Z')}
      />,
    )

    expect(container.querySelectorAll('[class~=\"bg-primary\"]')).toHaveLength(1)
    expect(container.querySelectorAll('[class~=\"bg-primary/60\"]')).toHaveLength(1)
  })
})

/* eslint-disable next/no-img-element */

import type { AnchorHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import EventCardSportsMoneyline from '@/app/[locale]/(platform)/(home)/_components/EventCardSportsMoneyline'

const mocks = vi.hoisted(() => ({
  eventBookmark: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce(
      (label, [key, value]) => label.replace(`{${key}}`, String(value)),
      message,
    ),
  useLocale: () => 'en-US',
}))

vi.mock('next/image', () => ({
  default: function MockImage({ fill: _fill, ...props }: any) {
    return <img {...props} />
  },
}))

vi.mock('@/components/AppLink', () => ({
  default: function MockAppLink({
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
  default: function MockEventBookmark(props: any) {
    mocks.eventBookmark(props)
    return <span data-testid="event-bookmark" />
  },
}))

vi.mock('@/components/ui/new-badge', () => ({
  NewBadge: () => <span data-testid="new-badge">New</span>,
}))

vi.mock('@/lib/events-routing', () => ({
  resolveEventOutcomePath: (_event: unknown, payload: { conditionId: string, outcomeIndex: number }) =>
    `/event/${payload.conditionId}/${payload.outcomeIndex}`,
}))

describe('eventCardSportsMoneyline', () => {
  beforeEach(() => {
    mocks.eventBookmark.mockReset()
  })

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
    expect(screen.getByText('Sat 7:00 PM ET')).toBeInTheDocument()
    expect(mocks.eventBookmark).toHaveBeenCalledWith(expect.objectContaining({
      refreshStatusOnMount: false,
    }))
  })

  it('renders full team names in active moneyline buttons', () => {
    const event = {
      status: 'active',
      volume: 2500,
      sports_sport_slug: 'soccer',
      sports_start_time: '2026-03-14T23:00:00.000Z',
      markets: [
        {
          condition_id: 'match-winner-condition',
          slug: 'france-vs-morocco-match-winner',
        },
      ],
    } as any

    const model = {
      team1: {
        name: 'France',
        abbreviation: 'FRA',
        color: '#1d4ed8',
        logoUrl: null,
        hostStatus: 'home',
      },
      team2: {
        name: 'Morocco',
        abbreviation: 'MAR',
        color: '#dc2626',
        logoUrl: null,
        hostStatus: 'away',
      },
      team1Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 0,
        label: 'FRA',
        tone: 'team1',
        color: '#1d4ed8',
      },
      team2Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 1,
        label: 'MAR',
        tone: 'team2',
        color: '#dc2626',
      },
    } as any

    render(
      <EventCardSportsMoneyline
        event={event}
        model={model}
        getDisplayChance={() => 61}
      />,
    )

    const franceButtonLabel = screen.getAllByText('France')
      .find(element => element.tagName.toLowerCase() === 'span')
    const moroccoButtonLabel = screen.getAllByText('Morocco')
      .find(element => element.tagName.toLowerCase() === 'span')

    expect(franceButtonLabel).toBeInTheDocument()
    expect(moroccoButtonLabel).toBeInTheDocument()
    expect(franceButtonLabel?.closest('a')).toHaveStyle('color: #1d4ed8')
    expect(moroccoButtonLabel?.closest('a')).toHaveStyle('color: #dc2626')
    expect(franceButtonLabel?.closest('a')).toHaveClass('hover:!text-white')
    expect(moroccoButtonLabel?.closest('a')).toHaveClass('hover:!text-white')
    expect(franceButtonLabel?.closest('a')).toHaveClass('dark:!text-[var(--home-sports-button-dark-text)]')
    expect(moroccoButtonLabel?.closest('a')).toHaveClass('dark:!text-[var(--home-sports-button-dark-text)]')
    expect(franceButtonLabel?.closest('a')).toHaveStyle('--home-sports-button-dark-text: #a9bcf0')
    expect(moroccoButtonLabel?.closest('a')).toHaveStyle('--home-sports-button-dark-text: #f2adad')
    expect(screen.queryByText('FRA')).not.toBeInTheDocument()
    expect(screen.queryByText('MAR')).not.toBeInTheDocument()
  })

  it('shows live team scores between the logo and team name', () => {
    const event = {
      status: 'active',
      volume: 2500,
      sports_live: true,
      sports_score: '2 - 1',
      sports_sport_slug: 'soccer',
      sports_start_time: '2026-03-14T23:00:00.000Z',
      markets: [
        {
          condition_id: 'match-winner-condition',
          slug: 'france-vs-morocco-match-winner',
        },
      ],
    } as any

    const model = {
      team1: {
        name: 'France',
        abbreviation: 'FRA',
        color: '#1d4ed8',
        logoUrl: 'https://example.com/france.png',
        hostStatus: 'home',
      },
      team2: {
        name: 'Morocco',
        abbreviation: 'MAR',
        color: '#dc2626',
        logoUrl: 'https://example.com/morocco.png',
        hostStatus: 'away',
      },
      team1Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 0,
        label: 'FRA',
        tone: 'team1',
        color: '#1d4ed8',
      },
      team2Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 1,
        label: 'MAR',
        tone: 'team2',
        color: '#dc2626',
      },
    } as any

    render(
      <EventCardSportsMoneyline
        event={event}
        model={model}
        getDisplayChance={() => 61}
      />,
    )

    expect(screen.getByLabelText('France score 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Morocco score 1')).toBeInTheDocument()
  })

  it('does not show live team scores when score data is missing', () => {
    const event = {
      status: 'active',
      volume: 2500,
      sports_live: true,
      sports_score: null,
      sports_sport_slug: 'soccer',
      sports_start_time: '2026-03-14T23:00:00.000Z',
      markets: [
        {
          condition_id: 'match-winner-condition',
          slug: 'france-vs-morocco-match-winner',
        },
      ],
    } as any

    const model = {
      team1: {
        name: 'France',
        abbreviation: 'FRA',
        color: '#1d4ed8',
        logoUrl: 'https://example.com/france.png',
        hostStatus: 'home',
      },
      team2: {
        name: 'Morocco',
        abbreviation: 'MAR',
        color: '#dc2626',
        logoUrl: 'https://example.com/morocco.png',
        hostStatus: 'away',
      },
      team1Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 0,
        label: 'FRA',
        tone: 'team1',
        color: '#1d4ed8',
      },
      team2Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 1,
        label: 'MAR',
        tone: 'team2',
        color: '#dc2626',
      },
    } as any

    render(
      <EventCardSportsMoneyline
        event={event}
        model={model}
        getDisplayChance={() => 61}
      />,
    )

    expect(screen.queryByLabelText('France score 0')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Morocco score 0')).not.toBeInTheDocument()
    expect(screen.getAllByText('France')).toHaveLength(2)
    expect(screen.getAllByText('Morocco')).toHaveLength(2)
  })

  it('renders the resolved winner and ended footer for sports cards', () => {
    const event = {
      status: 'resolved',
      resolved_at: '2026-03-22T00:00:00.000Z',
      volume: 0,
      sports_sport_slug: 'soccer',
      sports_tags: ['brazil-serie-a'],
      markets: [
        {
          condition_id: 'match-winner-condition',
          slug: 'arsenal-vs-chelsea-match-winner',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Arsenal',
              is_winning_outcome: true,
            },
            {
              outcome_index: 1,
              outcome_text: 'Chelsea',
              is_winning_outcome: false,
            },
          ],
          condition: {
            payout_numerators: [1, 0],
          },
        },
      ],
    } as any

    const model = {
      team1: {
        name: 'Arsenal',
        abbreviation: 'ARS',
        color: '#ef4444',
        logoUrl: null,
        hostStatus: 'home',
      },
      team2: {
        name: 'Chelsea',
        abbreviation: 'CHE',
        color: '#2563eb',
        logoUrl: null,
        hostStatus: 'away',
      },
      team1Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 0,
        label: 'ARS',
        tone: 'team1',
        color: '#ef4444',
      },
      team2Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 1,
        label: 'CHE',
        tone: 'team2',
        color: '#2563eb',
      },
    } as any

    render(
      <EventCardSportsMoneyline
        event={event}
        model={model}
        getDisplayChance={() => 61}
      />,
    )

    expect(screen.getByText('Brazil Serie A')).toBeInTheDocument()
    expect(screen.getByText('Ended Mar 22, 2026')).toBeInTheDocument()
    expect(screen.getAllByText('Arsenal')).toHaveLength(2)
    expect(screen.queryByText('ARS')).not.toBeInTheDocument()
    expect(screen.queryByText('CHE')).not.toBeInTheDocument()
    expect(screen.queryByTestId('event-bookmark')).not.toBeInTheDocument()
  })

  it('shows the new badge instead of volume for active zero-volume sports cards', () => {
    const event = {
      status: 'active',
      volume: 0,
      created_at: '2026-03-01T00:00:00.000Z',
      series_recurrence: null,
      sports_sport_slug: 'soccer',
      markets: [
        {
          condition_id: 'match-winner-condition',
          slug: 'arsenal-vs-chelsea-match-winner',
          created_at: '2026-03-01T00:00:00.000Z',
        },
      ],
    } as any

    const model = {
      team1: {
        name: 'Arsenal',
        abbreviation: 'ARS',
        color: null,
        logoUrl: null,
        hostStatus: 'home',
      },
      team2: {
        name: 'Chelsea',
        abbreviation: 'CHE',
        color: null,
        logoUrl: null,
        hostStatus: 'away',
      },
      team1Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 0,
        label: 'ARS',
        tone: 'team1',
        color: null,
      },
      team2Button: {
        conditionId: 'match-winner-condition',
        outcomeIndex: 1,
        label: 'CHE',
        tone: 'team2',
        color: null,
      },
    } as any

    render(
      <EventCardSportsMoneyline
        event={event}
        model={model}
        getDisplayChance={() => 50}
      />,
    )

    expect(screen.getByTestId('new-badge')).toBeInTheDocument()
    expect(screen.queryByText('$0 Vol.')).not.toBeInTheDocument()
  })
})

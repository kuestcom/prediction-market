import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EventCard from '@/app/[locale]/(platform)/(home)/_components/EventCard'

const mocks = vi.hoisted(() => ({
  buildHomeSportsMoneylineModel: vi.fn(),
  dynamicSportsCard: vi.fn(),
  eventCardHeader: vi.fn(),
  locale: 'en-US',
  singleMarketActions: vi.fn(),
  useXTrackerTweetCount: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce(
      (label, [key, value]) => label.replace(`{${key}}`, String(value)),
      message,
    ),
  useLocale: () => mocks.locale,
}))

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => function MockDynamicSportsCard(props: any) {
    mocks.dynamicSportsCard(props)
    return <div data-testid="sports-moneyline-card" />
  },
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventCardFooter', () => ({
  default: () => <div data-testid="event-card-footer" />,
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventCardHeader', () => ({
  default: (props: any) => {
    mocks.eventCardHeader(props)
    return <div data-testid="event-card-header" />
  },
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventCardMarketsList', () => ({
  default: () => <div data-testid="event-card-markets-list" />,
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/EventCardSingleMarketActions', () => ({
  default: (props: any) => {
    mocks.singleMarketActions(props)
    return <div data-testid="event-card-single-market-actions" />
  },
}))

vi.mock('@/app/[locale]/(platform)/(home)/_utils/eventCardResolvedOutcome', () => ({
  resolveEventCardResolvedOutcomeIndex: () => null,
  shouldUseResolvedXTracker: () => false,
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_hooks/useXTrackerTweetCount', () => ({
  useXTrackerTweetCount: (...args: any[]) => mocks.useXTrackerTweetCount(...args),
}))

vi.mock('@/lib/event-new-badge', () => ({
  shouldShowEventNewBadge: () => false,
}))

vi.mock('@/lib/home-events', () => ({
  isEventResolvedLike: () => false,
}))

vi.mock('@/lib/market-chance', () => ({
  buildChanceByMarket: () => ({ 'market-1': 62 }),
}))

vi.mock('@/lib/sports-home-card', () => ({
  buildHomeSportsMoneylineModel: (event: any) => mocks.buildHomeSportsMoneylineModel(event),
}))

const EVENT = {
  id: 'event-1',
  title: 'Will this event happen?',
  creator: 'Creator',
  icon_url: null,
  total_markets_count: 1,
  markets: [
    {
      condition_id: 'market-1',
      is_resolved: false,
      condition: {
        resolved: false,
      },
      outcomes: [
        {
          outcome_index: 0,
          outcome_text: 'Yes',
        },
        {
          outcome_index: 1,
          outcome_text: 'No',
        },
      ],
    },
  ],
} as any

describe('eventCard', () => {
  beforeEach(() => {
    mocks.buildHomeSportsMoneylineModel.mockReset()
    mocks.dynamicSportsCard.mockReset()
    mocks.eventCardHeader.mockReset()
    mocks.locale = 'en-US'
    mocks.singleMarketActions.mockReset()
    mocks.useXTrackerTweetCount.mockReset()
    mocks.useXTrackerTweetCount.mockReturnValue({ data: null })
  })

  it('keeps the standard card path out of the sports moneyline component', () => {
    mocks.buildHomeSportsMoneylineModel.mockReturnValue(null)

    render(<EventCard event={EVENT} />)

    expect(screen.getByTestId('event-card-header')).toBeInTheDocument()
    expect(screen.getByTestId('event-card-footer')).toBeInTheDocument()
    expect(screen.getByTestId('event-card-single-market-actions')).toBeInTheDocument()
    expect(screen.queryByTestId('sports-moneyline-card')).not.toBeInTheDocument()
    expect(mocks.dynamicSportsCard).not.toHaveBeenCalled()
  })

  it('uses standard Yes and No action labels when a binary market has no outcome rows', () => {
    mocks.buildHomeSportsMoneylineModel.mockReturnValue(null)

    render(
      <EventCard
        event={{
          ...EVENT,
          volume: 0,
          markets: [
            {
              ...EVENT.markets[0],
              volume: 0,
              volume_24h: 0,
              outcomes: [],
              condition: {
                resolved: false,
                volume: 0,
              },
            },
          ],
        } as any}
      />,
    )

    expect(screen.getByTestId('event-card-single-market-actions')).toBeInTheDocument()
    expect(mocks.singleMarketActions).toHaveBeenCalledWith(expect.objectContaining({
      yesOutcome: expect.objectContaining({
        outcome_index: 0,
        outcome_text: 'Yes',
      }),
      noOutcome: expect.objectContaining({
        outcome_index: 1,
        outcome_text: 'No',
      }),
    }))
  })

  it('uses the canonical crypto cadence title on event cards', () => {
    mocks.buildHomeSportsMoneylineModel.mockReturnValue(null)

    render(
      <EventCard
        event={{
          ...EVENT,
          title: 'Bitcoin Up or Down - July 28, 8:15AM ET',
          end_date: '2026-07-28T12:15:00.000Z',
          main_tag: 'Crypto',
          series_recurrence: 'daily',
          series_slug: 'btc-up-or-down-15m',
          tags: [],
        }}
      />,
    )

    expect(mocks.eventCardHeader).toHaveBeenCalledWith(expect.objectContaining({
      title: 'BTC Up or Down 15m',
    }))
  })

  it('uses the localized crypto cadence title on translated event cards', () => {
    mocks.buildHomeSportsMoneylineModel.mockReturnValue(null)
    mocks.locale = 'pt'

    render(
      <EventCard
        event={{
          ...EVENT,
          title: 'Bitcoin sobe ou desce — 28 de julho, 08:15 ET',
          end_date: '2026-07-28T12:15:00.000Z',
          main_tag: 'Cripto',
          series_recurrence: 'daily',
          series_slug: 'btc-up-or-down-15m',
          tags: [{ slug: 'crypto', name: 'Cripto' }],
        }}
      />,
    )

    expect(mocks.eventCardHeader).toHaveBeenCalledWith(expect.objectContaining({
      title: 'BTC sobe ou desce 15m',
    }))
  })

  it('renders the sports moneyline branch through the dynamic component boundary', () => {
    const model = {
      team1Button: {
        conditionId: 'market-1',
        outcomeIndex: 0,
      },
      team2Button: {
        conditionId: 'market-1',
        outcomeIndex: 1,
      },
    }
    mocks.buildHomeSportsMoneylineModel.mockReturnValue(model)

    render(
      <EventCard
        event={EVENT}
        priceOverridesByMarket={{ 'market-1': 62 }}
        enableHomeSportsMoneylineLayout
        currentTimestamp={123}
      />,
    )

    expect(screen.getByTestId('sports-moneyline-card')).toBeInTheDocument()
    expect(screen.queryByTestId('event-card-header')).not.toBeInTheDocument()
    expect(mocks.dynamicSportsCard).toHaveBeenCalledWith(expect.objectContaining({
      currentTimestamp: 123,
      event: EVENT,
      model,
    }))
    expect(mocks.dynamicSportsCard.mock.calls[0]?.[0].getDisplayChance('market-1')).toBe(62)
  })
})

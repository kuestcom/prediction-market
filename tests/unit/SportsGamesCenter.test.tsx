import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { createElement } from 'react'

import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  isMobile: false,
  push: mock(),
  setIsMobileOrderPanelOpen: mock(),
}))

void mock.module('next/image', () => ({
  default: function MockImage({ fill: _fill, ...props }: any) {
    return createElement('img', props)
  },
}))

void mock.module('next-intl', () => ({
  useLocale: () => 'en',
  useExtracted: () => (message: string, values?: Record<string, unknown>) =>
    values
      ? message.replace(/\{(\w+)\}/g, (_, key: string) => {
          const value = values[key]
          return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : '{' + key + '}'
        })
      : message,
}))

void mock.module('@/i18n/navigation', () => ({
  Link: function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: mocks.push }),
}))

void mock.module('@/hooks/useCurrentTimestamp', () => ({
  useCurrentTimestamp: () => Date.parse('2026-03-12T12:00:00.000Z'),
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: () => mocks.isMobile,
}))

void mock.module('@/stores/useOrder', () => ({
  useOrder: Object.assign(
    (selector: any) =>
      selector({
        event: null,
        market: null,
        outcome: null,
        setEvent: mock(),
        setMarket: mock(),
        setOutcome: mock(),
        setSide: mock(),
        setIsMobileOrderPanelOpen: mocks.setIsMobileOrderPanelOpen,
      }),
    {
      getState: () => ({
        event: null,
        market: null,
        outcome: null,
      }),
    },
  ),
}))

void mock.module('@/stores/useSportsLivestream', () => ({
  useSportsLivestream: (selector: any) => selector({ openStream: mock() }),
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook', () => ({
  useOrderBookSummaries: () => ({ data: null, isLoading: false, isRefetching: false, refetch: mock() }),
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm', () => ({
  default: function MockEventOrderPanelForm() {
    return <div data-testid="order-panel-form" />
  },
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile', () => ({
  default: function MockEventOrderPanelMobile() {
    return <div data-testid="mobile-order-panel" />
  },
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer', () => ({
  default: function MockEventOrderPanelTermsDisclaimer() {
    return <div data-testid="order-panel-disclaimer" />
  },
}))

void mock.module('@/app/[locale]/(platform)/sports/_components/SportsLivestreamFloatingPlayer', () => ({
  default: function MockSportsLivestreamFloatingPlayer() {
    return null
  },
}))

void mock.module('@/app/[locale]/(platform)/sports/_components/_sports-games-center/SportsGameDetailsPanel', () => ({
  default: function MockSportsGameDetailsPanel(props: { showBottomContent: boolean; activeDetailsTab: string }) {
    if (!props.showBottomContent) {
      return null
    }

    return <div data-testid="sports-game-details-panel" data-active-details-tab={props.activeDetailsTab} />
  },
}))

void mock.module(
  '@/app/[locale]/(platform)/sports/_components/_sports-games-center/SportsOrderPanelMarketInfo',
  () => ({
    default: function MockSportsOrderPanelMarketInfo() {
      return <div data-testid="sports-order-panel-market-info" />
    },
  }),
)

void mock.module('@/components/ui/button', () => ({
  Button: function MockButton({ nativeButton: _nativeButton, render, ...props }: any) {
    return render ?? <button {...props} />
  },
}))

void mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, closeOnClick: _closeOnClick, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
}))

void mock.module('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

void mock.module('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, render }: any) => render ?? <>{children}</>,
}))

function createSportsCard() {
  const market = {
    id: 'market-1',
    condition_id: 'condition-moneyline',
    slug: 'alpha-vs-beta-moneyline',
    title: 'Alpha vs Beta',
    short_title: 'Alpha vs Beta',
    sports_market_type: 'moneyline',
    is_resolved: false,
    outcomes: [
      {
        id: 'outcome-alpha',
        outcome_index: 0,
        outcome_text: 'Alpha',
        token_id: 'token-alpha',
      },
      {
        id: 'outcome-beta',
        outcome_index: 1,
        outcome_text: 'Beta',
        token_id: 'token-beta',
      },
    ],
  }

  return {
    id: 'card-1',
    slug: 'alpha-vs-beta',
    title: 'Alpha vs Beta',
    eventHref: '/sports/nba/alpha-vs-beta',
    volume: 12500,
    marketsCount: 1,
    eventCreatedAt: '2026-03-01T00:00:00.000Z',
    eventResolvedAt: null,
    startTime: '2026-03-14T23:00:00.000Z',
    week: 1,
    event: {
      id: 'event-1',
      slug: 'alpha-vs-beta',
      title: 'Alpha vs Beta',
      status: 'active',
      volume: 12500,
      sports_ended: false,
      sports_live: false,
      sports_score: null,
      sports_sport_slug: 'nba',
      sports_start_time: '2026-03-14T23:00:00.000Z',
      markets: [market],
    },
    teams: [
      {
        name: 'Alpha',
        abbreviation: 'ALP',
        record: '10-2',
        color: '#2563eb',
        logoUrl: null,
        hostStatus: 'home',
      },
      {
        name: 'Beta',
        abbreviation: 'BET',
        record: '8-4',
        color: '#dc2626',
        logoUrl: null,
        hostStatus: 'away',
      },
    ],
    detailMarkets: [market],
    defaultConditionId: 'condition-moneyline',
    buttons: [
      {
        key: 'condition-moneyline-alpha',
        conditionId: 'condition-moneyline',
        outcomeIndex: 0,
        fallbackIsNoOutcome: false,
        label: 'ALP',
        cents: 62,
        color: '#2563eb',
        marketType: 'moneyline',
        tone: 'team1',
      },
      {
        key: 'condition-moneyline-beta',
        conditionId: 'condition-moneyline',
        outcomeIndex: 1,
        fallbackIsNoOutcome: true,
        label: 'BET',
        cents: 38,
        color: '#dc2626',
        marketType: 'moneyline',
        tone: 'team2',
      },
    ],
  } as any
}

function renderSportsGamesCenter() {
  return render(
    <SportsGamesCenter
      cards={[createSportsCard()]}
      sportSlug="nba"
      sportTitle="NBA"
      initialWeek={1}
      showHeading={false}
    />,
  )
}

describe('sportsGamesCenter card actions', () => {
  beforeEach(() => {
    mocks.isMobile = false
    mocks.push.mockReset()
    mocks.setIsMobileOrderPanelOpen.mockReset()
  })

  it('navigates from the card body and opens the order book from the icon-only right-side control', async () => {
    const user = userEvent.setup()
    renderSportsGamesCenter()

    expect(screen.getByRole('link', { name: 'Open Alpha vs Beta' })).toHaveAttribute(
      'href',
      '/sports/nba/alpha-vs-beta',
    )
    expect(screen.queryByText('Game View')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sports-game-details-panel')).not.toBeInTheDocument()

    const orderBookButton = screen.getByRole('button', { name: 'Open order book' })
    expect(orderBookButton.textContent).toBe('')

    await user.click(orderBookButton)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(screen.getByTestId('sports-game-details-panel')).toHaveAttribute('data-active-details-tab', 'orderBook')
  })

  it('does not render the order-book opener on mobile', () => {
    mocks.isMobile = true

    renderSportsGamesCenter()

    expect(screen.queryByRole('button', { name: 'Open order book' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('sports-game-details-panel')).not.toBeInTheDocument()
  })
})

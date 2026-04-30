import type { Event, Market, Outcome } from '@/types'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EventOrderStateSync from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderStateSync'
import { ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'

const mocks = vi.hoisted(() => {
  const orderState = {} as any
  const useOrder = vi.fn((selector?: (state: any) => unknown) => {
    if (typeof selector === 'function') {
      return selector(orderState)
    }
    return orderState
  }) as any
  useOrder.getState = vi.fn(() => orderState)

  return {
    orderState,
    searchParams: new URLSearchParams(),
    useIsMobile: vi.fn(() => false),
    useOrder,
    useSyncLimitPriceWithOutcome: vi.fn(),
  }
})

vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.searchParams,
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

vi.mock('@/stores/useOrder', () => ({
  useOrder: mocks.useOrder,
  useSyncLimitPriceWithOutcome: mocks.useSyncLimitPriceWithOutcome,
}))

function createOutcome(outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO) {
  return {
    outcome_index: outcomeIndex,
    token_id: `token-${outcomeIndex}`,
  } as Outcome
}

function createMarket() {
  return {
    condition_id: 'condition-1',
    slug: 'winner',
    is_active: true,
    outcomes: [
      createOutcome(OUTCOME_INDEX.YES),
      createOutcome(OUTCOME_INDEX.NO),
    ],
  } as Market
}

function createEvent(market: Market) {
  return {
    id: 'event-1',
    markets: [market],
  } as Event
}

function resetOrderState() {
  Object.assign(mocks.orderState, {
    event: null,
    market: null,
    outcome: null,
    type: ORDER_TYPE.MARKET,
    setAmount: vi.fn((amount: string) => {
      mocks.orderState.amount = amount
    }),
    setEvent: vi.fn((event: Event) => {
      mocks.orderState.event = event
    }),
    setIsMobileOrderPanelOpen: vi.fn((open: boolean) => {
      mocks.orderState.isMobileOrderPanelOpen = open
    }),
    setLimitShares: vi.fn((shares: string) => {
      mocks.orderState.limitShares = shares
    }),
    setMarket: vi.fn((market: Market) => {
      mocks.orderState.market = market
    }),
    setOutcome: vi.fn((outcome: Outcome) => {
      mocks.orderState.outcome = outcome
    }),
    setSide: vi.fn((side: string) => {
      mocks.orderState.side = side
    }),
    setType: vi.fn((type: string) => {
      mocks.orderState.type = type
    }),
  })
}

describe('EventOrderStateSync', () => {
  beforeEach(() => {
    resetOrderState()
    mocks.searchParams = new URLSearchParams('side=BUY&orderType=MARKET&outcomeIndex=0&shares=10')
    mocks.useIsMobile.mockReturnValue(false)
    mocks.useOrder.mockClear()
    mocks.useOrder.getState.mockClear()
    mocks.useSyncLimitPriceWithOutcome.mockClear()
  })

  it('opens the mobile order panel when the mobile breakpoint resolves after query params apply', async () => {
    const market = createMarket()
    const event = createEvent(market)

    const view = render(<EventOrderStateSync event={event} />)

    await waitFor(() => {
      expect(mocks.orderState.setMarket).toHaveBeenCalledWith(market)
    })
    expect(mocks.orderState.setIsMobileOrderPanelOpen).not.toHaveBeenCalled()

    mocks.useIsMobile.mockReturnValue(true)
    view.rerender(<EventOrderStateSync event={event} />)

    await waitFor(() => {
      expect(mocks.orderState.setIsMobileOrderPanelOpen).toHaveBeenCalledWith(true)
    })
  })
})

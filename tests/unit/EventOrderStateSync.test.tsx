import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import type { Event, Market, Outcome } from '@/types'

import EventOrderStateSync from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderStateSync'
import { ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => {
  const orderState = {} as any
  const useOrder = mock((selector?: (state: any) => unknown) => {
    if (typeof selector === 'function') {
      return selector(orderState)
    }
    return orderState
  }) as any
  useOrder.getState = mock(() => orderState)

  return {
    orderState,
    searchParams: new URLSearchParams(),
    useIsMobile: mock(() => false),
    useOrder,
    useSyncLimitPriceWithOutcome: mock(),
  }
})

void mock.module('next/navigation', () => ({
  useSearchParams: () => mocks.searchParams,
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

void mock.module('@/stores/useOrder', () => ({
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
    outcomes: [createOutcome(OUTCOME_INDEX.YES), createOutcome(OUTCOME_INDEX.NO)],
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
    setAmount: mock((amount: string) => {
      mocks.orderState.amount = amount
    }),
    setEvent: mock((event: Event) => {
      mocks.orderState.event = event
    }),
    setIsMobileOrderPanelOpen: mock((open: boolean) => {
      mocks.orderState.isMobileOrderPanelOpen = open
    }),
    setLimitShares: mock((shares: string) => {
      mocks.orderState.limitShares = shares
    }),
    setMarket: mock((market: Market) => {
      mocks.orderState.market = market
    }),
    setOutcome: mock((outcome: Outcome) => {
      mocks.orderState.outcome = outcome
    }),
    setSide: mock((side: string) => {
      mocks.orderState.side = side
    }),
    setType: mock((type: string) => {
      mocks.orderState.type = type
    }),
  })
}

describe('eventOrderStateSync', () => {
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

'use client'

import type { RefObject } from 'react'
import type { Event, Market, OrderSide, OrderType, Outcome } from '@/types'
import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { useOptionalEventOutcomeChances } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useOrderBookSummaries'
import { normalizeBookLevels } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderPanelUtils'
import { ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { toCents } from '@/lib/formatters'

type ConditionShares = Record<typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, number>

export type LimitExpirationOption = 'end-of-day' | 'custom'

interface OrderState {
  // Order state
  event: Event | null
  market: Market | null
  outcome: Outcome | null
  side: OrderSide
  type: OrderType
  amount: string
  limitPrice: string
  limitShares: string
  limitExpirationEnabled: boolean
  limitExpirationOption: LimitExpirationOption
  limitExpirationTimestamp: number | null
  isLoading: boolean
  isMobileOrderPanelOpen: boolean
  inputRef: RefObject<HTMLInputElement | null>
  lastMouseEvent: any

  userShares: Record<string, ConditionShares>

  // Actions
  setEvent: (event: Event) => void
  setMarket: (market: Market) => void
  setOutcome: (outcome: Outcome) => void
  reset: () => void
  setSide: (side: OrderSide) => void
  setType: (type: OrderType) => void
  setAmount: (amount: string) => void
  setLimitPrice: (price: string) => void
  setLimitShares: (shares: string) => void
  setLimitExpirationEnabled: (enabled: boolean) => void
  setLimitExpirationOption: (option: LimitExpirationOption) => void
  setLimitExpirationTimestamp: (timestamp: number | null) => void
  setIsLoading: (loading: boolean) => void
  setIsMobileOrderPanelOpen: (loading: boolean) => void
  setLastMouseEvent: (lastMouseEvent: any) => void
  setUserShares: (shares: Record<string, ConditionShares>, options?: { replace?: boolean }) => void
}

export const useOrder = create<OrderState>()((set, _, store) => ({
  event: null,
  market: null,
  outcome: null,
  side: ORDER_SIDE.BUY,
  type: ORDER_TYPE.MARKET,
  amount: '',
  limitPrice: '0.0',
  limitShares: '0',
  limitExpirationEnabled: false,
  limitExpirationOption: 'end-of-day',
  limitExpirationTimestamp: null,
  isLoading: false,
  isMobileOrderPanelOpen: false,
  inputRef: { current: null as HTMLInputElement | null },
  lastMouseEvent: null,
  userShares: {},

  setEvent: (event: Event) => set({ event }),
  setMarket: (market: Market) => set({ market }),
  setOutcome: (outcome: Outcome) => set({ outcome }),
  reset: () => set(store.getInitialState()),
  setSide: (side: OrderSide) => set({ side }),
  setType: (type: OrderType) => set(state => ({
    type,
    amount: '',
    limitPrice: '0.0',
    limitShares: '0',
    limitExpirationEnabled: false,
    limitExpirationOption: 'end-of-day',
    limitExpirationTimestamp: null,
    side: state.side,
  })),
  setAmount: (amount: string) => set({ amount }),
  setLimitPrice: (price: string) => set({ limitPrice: price }),
  setLimitShares: (shares: string) => set({ limitShares: shares }),
  setLimitExpirationEnabled: (enabled: boolean) => set({ limitExpirationEnabled: enabled }),
  setLimitExpirationOption: (option: LimitExpirationOption) => set({ limitExpirationOption: option }),
  setLimitExpirationTimestamp: (timestamp: number | null) => set({ limitExpirationTimestamp: timestamp }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  setIsMobileOrderPanelOpen: (open: boolean) => set({ isMobileOrderPanelOpen: open }),
  setLastMouseEvent: (lastMouseEvent: any) => set({ lastMouseEvent }),
  setUserShares: (shares: Record<string, ConditionShares>, options?: { replace?: boolean }) => set(state => ({
    userShares: options?.replace ? shares : { ...state.userShares, ...shares },
  })),
}))

function getTopOfBookPrice(
  summary: { bids?: { price?: string, size?: string }[], asks?: { price?: string, size?: string }[] } | undefined,
  side: 'ask' | 'bid',
) {
  const levels = normalizeBookLevels(side === 'ask' ? summary?.asks : summary?.bids, side)
  return levels[0]?.priceDollars ?? null
}

function clampUnitPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

export function useOutcomeTopOfBookPrice(
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
  sideOverride?: OrderSide,
) {
  const market = useOrder(state => state.market)
  const orderSide = useOrder(state => state.side)
  const outcome = market?.outcomes.find(current => current.outcome_index === outcomeIndex)
    ?? market?.outcomes[outcomeIndex]
  const tokenId = outcome?.token_id ? String(outcome.token_id) : null
  const { data: orderBookSummaries } = useOrderBookSummaries(
    tokenId ? [tokenId] : [],
    { enabled: Boolean(tokenId) },
  )
  const chanceByMarket = useOptionalEventOutcomeChances()
  const fallbackYesPrice = useMemo(() => {
    const conditionId = market?.condition_id
    if (!conditionId) {
      return null
    }

    const liveChance = chanceByMarket[conditionId]
    if (typeof liveChance === 'number' && Number.isFinite(liveChance)) {
      return clampUnitPrice(liveChance / 100)
    }

    return null
  }, [chanceByMarket, market?.condition_id])

  return useMemo(() => {
    if (tokenId) {
      const summary = orderBookSummaries?.[tokenId]
      const resolvedSide = sideOverride ?? orderSide
      const bookSide = resolvedSide === ORDER_SIDE.BUY ? 'ask' : 'bid'
      const topOfBookPrice = getTopOfBookPrice(summary, bookSide)
      if (topOfBookPrice != null) {
        return topOfBookPrice
      }
    }

    if (fallbackYesPrice == null) {
      return null
    }

    return outcomeIndex === OUTCOME_INDEX.NO
      ? clampUnitPrice(1 - fallbackYesPrice)
      : fallbackYesPrice
  }, [fallbackYesPrice, orderBookSummaries, orderSide, outcomeIndex, sideOverride, tokenId])
}

export function useYesPrice() {
  return useOutcomeTopOfBookPrice(OUTCOME_INDEX.YES)
}

export function useNoPrice() {
  return useOutcomeTopOfBookPrice(OUTCOME_INDEX.NO)
}

export function useIsSingleMarket() {
  return useOrder(state => state.event?.total_markets_count === 1)
}

export function useIsLimitOrder() {
  return useOrder(state => state.type === ORDER_TYPE.LIMIT)
}

export function useAmountAsNumber() {
  return useOrder(state => Number.parseFloat(state.amount) || 0)
}

export function useSyncLimitPriceWithOutcome() {
  const outcomeIndex = useOrder(state => state.outcome?.outcome_index)
  const syncKey = useOrder(state => [
    state.event?.id ?? 'no-event',
    state.market?.condition_id ?? 'no-market',
    state.outcome?.token_id ?? 'no-outcome',
  ].join(':'))
  const setLimitPrice = useOrder(state => state.setLimitPrice)
  const yesPrice = useYesPrice()
  const noPrice = useNoPrice()
  const lastSyncKeyRef = useRef(syncKey)
  const hasSyncedRef = useRef(false)

  useEffect(() => {
    if (syncKey !== lastSyncKeyRef.current) {
      lastSyncKeyRef.current = syncKey
      hasSyncedRef.current = false
    }

    if (outcomeIndex === undefined || outcomeIndex === null) {
      return
    }

    if (hasSyncedRef.current) {
      return
    }

    const nextPrice = outcomeIndex === OUTCOME_INDEX.NO ? noPrice : yesPrice
    if (nextPrice === null || nextPrice === undefined) {
      return
    }

    const cents = toCents(nextPrice)
    if (cents === null) {
      return
    }

    setLimitPrice(cents.toFixed(1))
    hasSyncedRef.current = true
  }, [noPrice, outcomeIndex, setLimitPrice, syncKey, yesPrice])
}

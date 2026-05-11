'use client'

import type { RefObject } from 'react'
import type { Event, Market, OrderSide, OrderType, Outcome } from '@/types'
import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useOrderBookSummaries'
import { ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { toCents } from '@/lib/formatters'
import { resolveOutcomeUnitPrice } from '@/lib/market-pricing'

const ORDER_TYPE_STORAGE_KEY = 'kuest:order-panel-type'

type ConditionShares = Record<typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, number>

export type LimitExpirationOption = 'end-of-day' | 'custom'

function normalizeConditionShareValue(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 1_000_000) / 1_000_000
}

function areUserSharesEqual(
  left: Record<string, ConditionShares>,
  right: Record<string, ConditionShares>,
) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((conditionId) => {
    const leftCondition = left[conditionId]
    const rightCondition = right[conditionId]

    if (!rightCondition) {
      return false
    }

    return (
      normalizeConditionShareValue(leftCondition?.[OUTCOME_INDEX.YES])
      === normalizeConditionShareValue(rightCondition?.[OUTCOME_INDEX.YES])
      && normalizeConditionShareValue(leftCondition?.[OUTCOME_INDEX.NO])
      === normalizeConditionShareValue(rightCondition?.[OUTCOME_INDEX.NO])
    )
  })
}

function areEventsEqual(left: Event | null | undefined, right: Event | null | undefined) {
  return left === right
}

function areMarketsEqual(left: Market | null | undefined, right: Market | null | undefined) {
  return left === right
}

function areOutcomesEqual(left: Outcome | null | undefined, right: Outcome | null | undefined) {
  return left === right
}

function resolveStoredOrderType() {
  if (typeof window === 'undefined') {
    return ORDER_TYPE.MARKET
  }

  try {
    const storedType = window.localStorage.getItem(ORDER_TYPE_STORAGE_KEY)
    if (storedType === ORDER_TYPE.LIMIT || storedType === ORDER_TYPE.MARKET) {
      return storedType
    }
  }
  catch {}

  return ORDER_TYPE.MARKET
}

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
  type: resolveStoredOrderType(),
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

  setEvent: (event: Event) => set((state) => {
    if (areEventsEqual(state.event, event)) {
      return state
    }

    return { event }
  }),
  setMarket: (market: Market) => set((state) => {
    if (areMarketsEqual(state.market, market)) {
      return state
    }

    return { market }
  }),
  setOutcome: (outcome: Outcome) => set((state) => {
    if (areOutcomesEqual(state.outcome, outcome)) {
      return state
    }

    return { outcome }
  }),
  reset: () => set(store.getInitialState()),
  setSide: (side: OrderSide) => set((state) => {
    if (state.side === side) {
      return state
    }

    return { side }
  }),
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
  setUserShares: (shares: Record<string, ConditionShares>, options?: { replace?: boolean }) => set((state) => {
    const nextUserShares = options?.replace ? shares : { ...state.userShares, ...shares }

    if (areUserSharesEqual(state.userShares, nextUserShares)) {
      return state
    }

    return { userShares: nextUserShares }
  }),
}))

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

  return useMemo(() => {
    return resolveOutcomeUnitPrice(market, outcomeIndex, {
      orderBookSummaries,
      side: sideOverride ?? orderSide,
    })
  }, [market, orderBookSummaries, orderSide, outcomeIndex, sideOverride])
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

interface SyncLimitPriceWithOutcomeParams {
  syncKey: string
  lastSyncKeyRef: { current: string }
  hasSyncedRef: { current: boolean }
  outcomeIndex: number | null | undefined
  noPrice: number | null | undefined
  yesPrice: number | null | undefined
  setLimitPrice: (price: string) => void
}

function syncLimitPriceWithOutcome({
  syncKey,
  lastSyncKeyRef,
  hasSyncedRef,
  outcomeIndex,
  noPrice,
  yesPrice,
  setLimitPrice,
}: SyncLimitPriceWithOutcomeParams) {
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

  useEffect(function syncLimitPriceWithSelectedOutcome() {
    syncLimitPriceWithOutcome({
      syncKey,
      lastSyncKeyRef,
      hasSyncedRef,
      outcomeIndex,
      noPrice,
      yesPrice,
      setLimitPrice,
    })
  }, [noPrice, outcomeIndex, setLimitPrice, syncKey, yesPrice])
}

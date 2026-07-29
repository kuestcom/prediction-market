'use client'

import { useEffect, useRef, useState } from 'react'

import type { TradeFlowLabelItem } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'

import { useMarketChannelSubscription } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import {
  buildTradeFlowLabel,
  pruneTradeFlowItems,
  tradeFlowCleanupIntervalMs,
  trimTradeFlowItems,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'

export function useEventChartTradeFlow(outcomeTokenIds: { yesTokenId: string; noTokenId: string } | null) {
  const outcomeTokenKey = outcomeTokenIds ? `${outcomeTokenIds.yesTokenId}:${outcomeTokenIds.noTokenId}` : ''

  const [tradeFlowState, setTradeFlowState] = useState<{
    tokenKey: string
    items: TradeFlowLabelItem[]
  }>({
    tokenKey: '',
    items: [],
  })

  const tradeFlowIdRef = useRef(0)

  const tradeFlowItems = tradeFlowState.tokenKey === outcomeTokenKey ? tradeFlowState.items : []
  const hasTradeFlowLabels = tradeFlowItems.length > 0

  useMarketChannelSubscription((payload) => {
    if (!outcomeTokenIds) {
      return
    }

    if (payload?.event_type !== 'last_trade_price') {
      return
    }

    const { yesTokenId, noTokenId } = outcomeTokenIds
    const assetId = payload.asset_id
    const price = Number(payload.price)
    const size = Number(payload.size)
    const label = buildTradeFlowLabel(price, size)

    if (!label) {
      return
    }

    let outcome: 'yes' | 'no' | null = null

    if (assetId === yesTokenId) {
      outcome = 'yes'
    }

    if (assetId === noTokenId) {
      outcome = 'no'
    }

    if (!outcome) {
      return
    }

    const createdAt = Date.now()
    const id = String(tradeFlowIdRef.current)
    tradeFlowIdRef.current += 1

    setTradeFlowState((prev) => {
      const activeItems = prev.tokenKey === outcomeTokenKey ? prev.items : []
      const nextItems = trimTradeFlowItems(
        pruneTradeFlowItems([...activeItems, { id, label, outcome, createdAt }], createdAt),
      )

      return {
        tokenKey: outcomeTokenKey,
        items: nextItems,
      }
    })
  })

  useEffect(() => {
    if (!outcomeTokenKey || !hasTradeFlowLabels) {
      return
    }

    const interval = window.setInterval(() => {
      const now = Date.now()
      setTradeFlowState((prev) => {
        const activeItems = prev.tokenKey === outcomeTokenKey ? prev.items : []
        const nextItems = pruneTradeFlowItems(activeItems, now)

        if (nextItems.length === activeItems.length && prev.tokenKey === outcomeTokenKey) {
          return prev
        }

        return {
          tokenKey: outcomeTokenKey,
          items: nextItems,
        }
      })
    }, tradeFlowCleanupIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [hasTradeFlowLabels, outcomeTokenKey])

  return { tradeFlowItems, hasTradeFlowLabels }
}

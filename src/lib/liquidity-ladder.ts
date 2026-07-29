import type { Market } from '@/types'

import { MAX_CLOB_BATCH_ORDERS, OUTCOME_INDEX } from '@/lib/constants'
import { isChainlinkMarketEnded } from '@/lib/mirror-resolution'
import { calculateBuyOrderFundingRequirement } from '@/lib/orders/validation'

const ORDERS_PER_LIQUIDITY_LADDER_LEVEL = 4

export const MAX_LIQUIDITY_LADDER_LEVELS = Math.floor(MAX_CLOB_BATCH_ORDERS / ORDERS_PER_LIQUIDITY_LADDER_LEVEL)
const MIN_LIQUIDITY_PRICE_CENTS = 1
const MAX_LIQUIDITY_PRICE_CENTS = 99

export interface LiquidityLadderOrder {
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  side: 'buy' | 'sell'
  priceCents: number
  shares: number
}

interface BuildLiquidityLadderArgs {
  centerPriceCents: number
  levelsPerSide: number
  priceStepCents: number
  sharesPerOrder: number
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

export function buildLiquidityLadder({
  centerPriceCents,
  levelsPerSide,
  priceStepCents,
  sharesPerOrder,
}: BuildLiquidityLadderArgs): LiquidityLadderOrder[] {
  if (
    !Number.isFinite(centerPriceCents) ||
    !Number.isFinite(levelsPerSide) ||
    !Number.isFinite(priceStepCents) ||
    !Number.isFinite(sharesPerOrder) ||
    sharesPerOrder <= 0
  ) {
    return []
  }

  const center = clampInteger(centerPriceCents, MIN_LIQUIDITY_PRICE_CENTS, MAX_LIQUIDITY_PRICE_CENTS)
  const levelCount = clampInteger(levelsPerSide, 1, MAX_LIQUIDITY_LADDER_LEVELS)
  const step = clampInteger(priceStepCents, 1, MAX_LIQUIDITY_PRICE_CENTS)
  const normalizedShares = Number(sharesPerOrder.toFixed(2))
  if (normalizedShares <= 0) {
    return []
  }

  function buildOutcomeOrders(outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, outcomeCenter: number) {
    const bids = new Map<number, LiquidityLadderOrder>()
    const asks = new Map<number, LiquidityLadderOrder>()

    for (let index = 1; index <= levelCount; index += 1) {
      const bidPrice = Math.max(MIN_LIQUIDITY_PRICE_CENTS, outcomeCenter - step * index)
      const askPrice = Math.min(MAX_LIQUIDITY_PRICE_CENTS, outcomeCenter + step * index)

      bids.set(bidPrice, {
        outcomeIndex,
        side: 'buy',
        priceCents: bidPrice,
        shares: normalizedShares,
      })
      asks.set(askPrice, {
        outcomeIndex,
        side: 'sell',
        priceCents: askPrice,
        shares: normalizedShares,
      })
    }

    return [
      ...[...bids.values()].sort((left, right) => right.priceCents - left.priceCents),
      ...[...asks.values()].sort((left, right) => left.priceCents - right.priceCents),
    ]
  }

  return [...buildOutcomeOrders(OUTCOME_INDEX.YES, center), ...buildOutcomeOrders(OUTCOME_INDEX.NO, 100 - center)]
}

export function getLiquidityLadderRequirements(orders: LiquidityLadderOrder[]) {
  const buyOrders = orders.filter((order) => order.side === 'buy')
  const sellOrders = orders.filter((order) => order.side === 'sell')
  const bidCost = buyOrders.reduce((total, order) => total + (order.shares * order.priceCents) / 100, 0)
  const primarySellShares = sellOrders
    .filter((order) => order.outcomeIndex === OUTCOME_INDEX.YES)
    .reduce((total, order) => total + order.shares, 0)
  const secondarySellShares = sellOrders
    .filter((order) => order.outcomeIndex === OUTCOME_INDEX.NO)
    .reduce((total, order) => total + order.shares, 0)

  return {
    buyOrders,
    sellOrders,
    bidCost: Number(calculateBuyOrderFundingRequirement(bidCost).toFixed(6)),
    splitShares: Number(Math.max(primarySellShares, secondarySellShares).toFixed(2)),
    signatureCount: orders.length + 1,
  }
}

export function canProvideMarketLiquidity(market: Market, nowMs: number) {
  const yesOutcome = market.outcomes.find((outcome) => outcome.outcome_index === OUTCOME_INDEX.YES)
  const noOutcome = market.outcomes.find((outcome) => outcome.outcome_index === OUTCOME_INDEX.NO)

  return Boolean(
    market.is_active &&
    !market.is_resolved &&
    !market.condition?.resolved &&
    market.accepting_orders !== false &&
    market.outcomes.length === 2 &&
    yesOutcome?.token_id &&
    noOutcome?.token_id &&
    !isChainlinkMarketEnded(market, nowMs),
  )
}

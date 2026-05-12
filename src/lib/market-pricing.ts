import type {
  OrderBookSummariesResponse,
  OrderBookSummaryResponse,
} from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { Market, Outcome } from '@/types'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { toCents } from '@/lib/formatters'
import { normalizeBookLevels } from '@/lib/order-panel-utils'

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

function normalizeMarketUnitPrice(market: Market | null | undefined) {
  if (!market) {
    return null
  }

  const value = Number.isFinite(market.price)
    ? market.price
    : Number.isFinite(market.probability)
      ? Number(market.probability) / 100
      : null

  return clampUnitPrice(value)
}

export function resolveMarketOutcome(
  market: Market | null | undefined,
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
) {
  if (!market) {
    return null
  }

  return market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)
    ?? market.outcomes[outcomeIndex]
    ?? null
}

export function resolveFallbackOutcomeUnitPrice(
  market: Market | null | undefined,
  outcomeOrIndex: Outcome | typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | null | undefined,
) {
  const outcome = typeof outcomeOrIndex === 'number'
    ? resolveMarketOutcome(market, outcomeOrIndex)
    : outcomeOrIndex ?? null

  if (outcome && Number.isFinite(outcome.buy_price)) {
    return clampUnitPrice(Number(outcome.buy_price))
  }

  const marketPrice = normalizeMarketUnitPrice(market)
  if (marketPrice == null) {
    return null
  }

  const isNoOutcome = outcome?.outcome_index === OUTCOME_INDEX.NO || outcomeOrIndex === OUTCOME_INDEX.NO

  return isNoOutcome
    ? clampUnitPrice(1 - marketPrice)
    : marketPrice
}

function resolveOutcomeSelectionUnitPrice(
  market: Market | null | undefined,
  outcome: Outcome | null | undefined,
  options?: {
    orderBookSummaries?: OrderBookSummariesResponse | null
    side?: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
    fallbackIsNoOutcome?: boolean
  },
) {
  const tokenId = outcome?.token_id ? String(outcome.token_id) : null
  const bookSide = options?.side === ORDER_SIDE.SELL ? 'bid' : 'ask'
  const topOfBookPrice = tokenId
    ? getTopOfBookUnitPrice(options?.orderBookSummaries?.[tokenId], bookSide)
    : null

  if (topOfBookPrice != null) {
    return topOfBookPrice
  }

  if (outcome && Number.isFinite(outcome.buy_price)) {
    return clampUnitPrice(Number(outcome.buy_price))
  }

  const marketPrice = normalizeMarketUnitPrice(market)
  if (marketPrice == null) {
    return null
  }

  return options?.fallbackIsNoOutcome ? clampUnitPrice(1 - marketPrice) : marketPrice
}

function getTopOfBookUnitPrice(
  summary: OrderBookSummaryResponse | null | undefined,
  side: 'ask' | 'bid',
) {
  const levels = normalizeBookLevels(side === 'ask' ? summary?.asks : summary?.bids, side)
  return levels[0]?.priceDollars ?? null
}

export function resolveOutcomeUnitPrice(
  market: Market | null | undefined,
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
  options?: {
    orderBookSummaries?: OrderBookSummariesResponse | null
    side?: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
  },
) {
  const outcome = resolveMarketOutcome(market, outcomeIndex)
  return resolveOutcomeSelectionUnitPrice(market, outcome, {
    orderBookSummaries: options?.orderBookSummaries,
    side: options?.side,
    fallbackIsNoOutcome: outcomeIndex === OUTCOME_INDEX.NO,
  })
}

export function resolveOutcomePriceCents(
  market: Market | null | undefined,
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
  options?: {
    orderBookSummaries?: OrderBookSummariesResponse | null
    side?: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
  },
) {
  return toCents(resolveOutcomeUnitPrice(market, outcomeIndex, options))
}

export function resolveOutcomeSelectionPriceCents(
  market: Market | null | undefined,
  outcome: Outcome | null | undefined,
  options?: {
    orderBookSummaries?: OrderBookSummariesResponse | null
    side?: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
    fallbackIsNoOutcome?: boolean
  },
) {
  return toCents(resolveOutcomeSelectionUnitPrice(market, outcome, options))
}

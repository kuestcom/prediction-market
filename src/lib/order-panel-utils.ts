import { MICRO_UNIT, ORDER_SIDE } from '@/lib/constants'

const MAX_LIMIT_PRICE = 99.9
const PRICE_EPSILON = 1e-8

export function normalizeShares(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0
  }

  return value > 100_000 ? value / MICRO_UNIT : value
}

export function getRoundedCents(rawPrice: number, side: 'ask' | 'bid') {
  const cents = rawPrice * 100
  if (!Number.isFinite(cents)) {
    return 0
  }

  const scaled = cents * 10
  const roundedScaled = side === 'bid'
    ? Math.floor(scaled + PRICE_EPSILON)
    : Math.ceil(scaled - PRICE_EPSILON)

  const normalized = Math.max(0, Math.min(roundedScaled / 10, MAX_LIMIT_PRICE))
  return Number(normalized.toFixed(1))
}

export interface NormalizedBookLevel {
  priceCents: number
  priceDollars: number
  size: number
}

export function normalizeBookLevels(
  levels: { price?: string, size?: string }[] | undefined,
  side: 'ask' | 'bid',
): NormalizedBookLevel[] {
  if (!levels?.length) {
    return []
  }

  const parsed = levels
    .map((entry) => {
      const price = Number(entry.price)
      const size = Number(entry.size)
      if (!Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0) {
        return null
      }

      const priceCents = getRoundedCents(price, side)
      const priceDollars = priceCents / 100
      if (priceCents <= 0 || priceDollars <= 0) {
        return null
      }

      return {
        priceCents,
        priceDollars,
        size: Number(size.toFixed(2)),
      }
    })
    .filter((entry): entry is { priceCents: number, priceDollars: number, size: number } => entry !== null)

  return parsed.sort((a, b) => (side === 'ask' ? a.priceDollars - b.priceDollars : b.priceDollars - a.priceDollars))
}

export function calculateMarketFill(
  side: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL,
  value: number,
  bids: NormalizedBookLevel[],
  asks: NormalizedBookLevel[],
) {
  const levels = side === ORDER_SIDE.SELL ? bids : asks
  if (!levels.length || value <= 0) {
    return {
      avgPriceCents: null as number | null,
      limitPriceCents: null as number | null,
      filledShares: 0,
      totalCost: 0,
    }
  }

  let remainingShares = side === ORDER_SIDE.SELL ? value : 0
  let remainingBudget = side === ORDER_SIDE.BUY ? value : 0
  let filledShares = 0
  let totalCost = 0
  let limitPriceCents: number | null = null

  for (const level of levels) {
    if (side === ORDER_SIDE.SELL && remainingShares <= 0) {
      break
    }
    if (side === ORDER_SIDE.BUY && remainingBudget <= 0) {
      break
    }

    if (side === ORDER_SIDE.SELL) {
      const fill = Math.min(level.size, remainingShares)
      if (fill <= 0) {
        continue
      }
      const cost = fill * level.priceDollars
      filledShares = Number((filledShares + fill).toFixed(4))
      totalCost = Number((totalCost + cost).toFixed(4))
      remainingShares = Math.max(0, Number((remainingShares - fill).toFixed(4)))
      limitPriceCents = level.priceCents
    }
    else {
      const maxSharesAtLevel = level.priceDollars > 0 ? remainingBudget / level.priceDollars : 0
      const fill = Math.min(level.size, maxSharesAtLevel)
      if (fill <= 0) {
        continue
      }
      const cost = fill * level.priceDollars
      filledShares = Number((filledShares + fill).toFixed(4))
      totalCost = Number((totalCost + cost).toFixed(4))
      remainingBudget = Math.max(0, Number((remainingBudget - cost).toFixed(4)))
      limitPriceCents = level.priceCents
    }
  }

  const avgPriceCents = filledShares > 0
    ? Number(((totalCost / filledShares) * 100).toFixed(1))
    : null

  return {
    avgPriceCents,
    limitPriceCents,
    filledShares: Number(filledShares.toFixed(4)),
    totalCost: Number(totalCost.toFixed(4)),
  }
}

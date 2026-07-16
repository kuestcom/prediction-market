import type { NormalizedBookLevel } from '@/lib/order-panel-utils'

interface ArbitrageSegment {
  shares: number
  kuestPrice: number
  polymarketPrice: number
  kuestUnitCost: number
  polymarketUnitCost: number
}

export interface ArbitrageQuote {
  kuestOutcome: 'YES' | 'NO'
  polymarketOutcome: 'YES' | 'NO'
  kuestTokenId: string
  polymarketTokenId: string
  edge: number
  shares: number
  kuestCost: number
  polymarketCost: number
  totalCost: number
  payout: number
  profit: number
  segments: ArbitrageSegment[]
  polymarketOrder?: {
    price: number
    shares: number
    maximumCost: number
  }
}

const ARBITRAGE_SHARE_DECIMALS = 2
const ARBITRAGE_SHARE_SCALE = 10 ** ARBITRAGE_SHARE_DECIMALS

function normalizeExecutableShares(shares: number) {
  if (!Number.isFinite(shares) || shares <= 0) {
    return 0
  }

  return Math.floor((shares + Number.EPSILON) * ARBITRAGE_SHARE_SCALE) / ARBITRAGE_SHARE_SCALE
}

function greatestCommonDivisor(left: number, right: number) {
  let a = Math.abs(Math.trunc(left))
  let b = Math.abs(Math.trunc(right))
  while (b !== 0) {
    const remainder = a % b
    a = b
    b = remainder
  }
  return a
}

function trimArbitrageQuote(quote: ArbitrageQuote, targetShares: number): ArbitrageQuote {
  let remainingShares = targetShares
  const segments: ArbitrageSegment[] = []

  for (const segment of quote.segments) {
    const shares = Math.min(segment.shares, remainingShares)
    if (!(shares > 0)) {
      break
    }
    segments.push({ ...segment, shares })
    remainingShares -= shares
  }

  const shares = segments.reduce((sum, segment) => sum + segment.shares, 0)
  const kuestCost = segments.reduce((sum, segment) => sum + segment.shares * segment.kuestUnitCost, 0)
  const polymarketCost = segments.reduce((sum, segment) => sum + segment.shares * segment.polymarketUnitCost, 0)
  const totalCost = kuestCost + polymarketCost

  return {
    ...quote,
    segments,
    shares,
    kuestCost,
    polymarketCost,
    totalCost,
    payout: shares,
    profit: shares - totalCost,
    edge: shares > 0 ? (shares - totalCost) / shares : 0,
    polymarketOrder: undefined,
  }
}

export function calculatePolymarketUnitCost(
  price: number,
  feeRate = 0,
  feeExponent = 0,
) {
  return price + Math.max(0, feeRate) * (
    price * (1 - price)
  ) ** Math.max(0, feeExponent)
}

function buildDirectionQuote({
  kuestOutcome,
  polymarketOutcome,
  kuestTokenId,
  polymarketTokenId,
  kuestAsks,
  polymarketAsks,
  kuestBalance,
  polymarketBalance,
  kuestFeeBps = 0,
  polymarketFeeRate = 0,
  polymarketFeeExponent = 0,
}: {
  kuestOutcome: 'YES' | 'NO'
  polymarketOutcome: 'YES' | 'NO'
  kuestTokenId: string
  polymarketTokenId: string
  kuestAsks: NormalizedBookLevel[]
  polymarketAsks: NormalizedBookLevel[]
  kuestBalance: number
  polymarketBalance: number
  kuestFeeBps?: number
  polymarketFeeRate?: number
  polymarketFeeExponent?: number
}): ArbitrageQuote | null {
  let kuestIndex = 0
  let polymarketIndex = 0
  let kuestLevelRemaining = kuestAsks[0]?.size ?? 0
  let polymarketLevelRemaining = polymarketAsks[0]?.size ?? 0
  let remainingKuestCash = Math.max(0, kuestBalance)
  let remainingPolymarketCash = Math.max(0, polymarketBalance)
  const segments: ArbitrageSegment[] = []

  while (kuestIndex < kuestAsks.length && polymarketIndex < polymarketAsks.length) {
    const kuestLevel = kuestAsks[kuestIndex]
    const polymarketLevel = polymarketAsks[polymarketIndex]
    const kuestUnitCost = kuestLevel
      ? kuestLevel.priceDollars * (1 + Math.max(0, kuestFeeBps) / 10_000)
      : 0
    const polymarketUnitCost = polymarketLevel
      ? calculatePolymarketUnitCost(
          polymarketLevel.priceDollars,
          polymarketFeeRate,
          polymarketFeeExponent,
        )
      : 0
    if (!kuestLevel || !polymarketLevel || kuestUnitCost + polymarketUnitCost >= 1) {
      break
    }

    const shares = Math.min(
      kuestLevelRemaining,
      polymarketLevelRemaining,
      kuestUnitCost > 0 ? remainingKuestCash / kuestUnitCost : 0,
      polymarketUnitCost > 0 ? remainingPolymarketCash / polymarketUnitCost : 0,
    )
    if (!(shares > 0)) {
      break
    }

    segments.push({
      shares,
      kuestPrice: kuestLevel.priceDollars,
      polymarketPrice: polymarketLevel.priceDollars,
      kuestUnitCost,
      polymarketUnitCost,
    })
    remainingKuestCash -= shares * kuestUnitCost
    remainingPolymarketCash -= shares * polymarketUnitCost
    kuestLevelRemaining -= shares
    polymarketLevelRemaining -= shares

    if (kuestLevelRemaining <= 1e-8) {
      kuestIndex += 1
      kuestLevelRemaining = kuestAsks[kuestIndex]?.size ?? 0
    }
    if (polymarketLevelRemaining <= 1e-8) {
      polymarketIndex += 1
      polymarketLevelRemaining = polymarketAsks[polymarketIndex]?.size ?? 0
    }
  }

  if (segments.length === 0) {
    return null
  }

  const shares = segments.reduce((sum, segment) => sum + segment.shares, 0)
  const kuestCost = segments.reduce((sum, segment) => sum + segment.shares * segment.kuestUnitCost, 0)
  const polymarketCost = segments.reduce((sum, segment) => sum + segment.shares * segment.polymarketUnitCost, 0)
  const totalCost = kuestCost + polymarketCost

  return {
    kuestOutcome,
    polymarketOutcome,
    kuestTokenId,
    polymarketTokenId,
    edge: shares > 0 ? (shares - totalCost) / shares : 0,
    shares,
    kuestCost,
    polymarketCost,
    totalCost,
    payout: shares,
    profit: shares - totalCost,
    segments,
  }
}

export function selectBestArbitrageQuote(directions: Parameters<typeof buildDirectionQuote>[0][]) {
  return directions
    .map(buildDirectionQuote)
    .filter((quote): quote is ArbitrageQuote => quote !== null)
    .sort((a, b) => b.profit - a.profit)[0] ?? null
}

export function scaleArbitrageQuote(quote: ArbitrageQuote, percent: number): ArbitrageQuote {
  const targetShares = normalizeExecutableShares(
    quote.shares * Math.min(100, Math.max(0, percent)) / 100,
  )
  return trimArbitrageQuote(quote, targetShares)
}

/**
 * Polymarket FOK buys are fixed-share limit orders, but the CLOB accepts the
 * maker amount with cents precision. Reduce the matched pair to the largest
 * exact share amount whose price cap produces a whole-cent maker amount.
 */
export function constrainArbitrageQuoteForPolymarketFok(
  quote: ArbitrageQuote,
  polymarketBalance = Number.POSITIVE_INFINITY,
): ArbitrageQuote | null {
  const lastSegment = quote.segments.at(-1)
  if (!lastSegment || !(quote.shares > 0)) {
    return null
  }

  const priceCents = Math.ceil((lastSegment.polymarketPrice - Number.EPSILON) * 100)
  if (priceCents <= 0 || priceCents >= 100) {
    return null
  }

  const price = priceCents / 100
  const shareStepHundredths = 100 / greatestCommonDivisor(priceCents, 100)
  const balanceLimitedShares = Number.isFinite(polymarketBalance)
    ? Math.max(0, polymarketBalance) / price
    : quote.shares
  const maximumShareHundredths = Math.floor(
    (Math.min(quote.shares, balanceLimitedShares) + Number.EPSILON) * 100,
  )
  const executableShareHundredths = Math.floor(
    maximumShareHundredths / shareStepHundredths,
  ) * shareStepHundredths
  const shares = executableShareHundredths / 100
  if (!(shares > 0)) {
    return null
  }

  const constrainedQuote = trimArbitrageQuote(quote, shares)
  const maximumCost = price * shares
  if (
    !(constrainedQuote.profit > 0)
    || Math.abs(maximumCost * 100 - Math.round(maximumCost * 100)) > 1e-7
  ) {
    return null
  }

  return {
    ...constrainedQuote,
    polymarketOrder: {
      price,
      shares,
      maximumCost,
    },
  }
}

export function findMinimumExecutableArbitrageQuote(
  quote: ArbitrageQuote,
  {
    minimumShares,
    minimumKuestAmount,
    minimumPolymarketAmount,
  }: {
    minimumShares: number
    minimumKuestAmount: number
    minimumPolymarketAmount: number
  },
): ArbitrageQuote | null {
  function meetsMinimum(candidate: ArbitrageQuote | null) {
    if (!candidate?.polymarketOrder || candidate.shares < minimumShares) {
      return false
    }

    const kuestPrincipal = candidate.segments.reduce(
      (total, segment) => total + segment.shares * segment.kuestPrice,
      0,
    )
    return kuestPrincipal >= minimumKuestAmount
      && candidate.polymarketOrder.maximumCost >= minimumPolymarketAmount
  }

  const maximumQuote = constrainArbitrageQuoteForPolymarketFok(quote)
  if (!meetsMinimum(maximumQuote)) {
    return null
  }

  let lowShares = 0
  let highShares = quote.shares
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const middleShares = (lowShares + highShares) / 2
    const candidate = constrainArbitrageQuoteForPolymarketFok(
      trimArbitrageQuote(quote, middleShares),
    )
    if (meetsMinimum(candidate)) {
      highShares = middleShares
    }
    else {
      lowShares = middleShares
    }
  }

  const firstShareHundredth = Math.max(1, Math.floor(lowShares * 100) - 1)
  const lastShareHundredth = Math.min(
    Math.ceil(quote.shares * 100),
    Math.ceil(highShares * 100) + 100,
  )
  for (
    let shareHundredths = firstShareHundredth;
    shareHundredths <= lastShareHundredth;
    shareHundredths += 1
  ) {
    const candidate = constrainArbitrageQuoteForPolymarketFok(
      trimArbitrageQuote(quote, shareHundredths / 100),
    )
    if (meetsMinimum(candidate)) {
      return candidate
    }
  }

  return maximumQuote
}

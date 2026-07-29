import type { NormalizedBookLevel } from '@/lib/order-panel-utils'

import { MICRO_UNIT } from '@/lib/constants'
import { toMicro } from '@/lib/formatters'

interface OutcomeArbitrageSegment {
  shares: number
  yesPrice: number
  noPrice: number
  yesUnitCost: number
  noUnitCost: number
}

export interface OutcomeArbitrageQuote {
  yesTokenId: string
  noTokenId: string
  edge: number
  shares: number
  yesCost: number
  noCost: number
  totalCost: number
  payout: number
  profit: number
  segments: OutcomeArbitrageSegment[]
  yesOrder: {
    price: number
    maximumCost: number
  }
  noOrder: {
    price: number
    maximumCost: number
  }
}

export interface OutcomeArbitragePreview {
  yesPrice: number | null
  noPrice: number | null
  edge: number | null
}

export function buildOutcomeArbitragePreview({
  yesAsks,
  noAsks,
  yesFeeBps,
  noFeeBps,
}: {
  yesAsks: NormalizedBookLevel[]
  noAsks: NormalizedBookLevel[]
  yesFeeBps: number | null
  noFeeBps: number | null
}): OutcomeArbitragePreview | null {
  const yesPrice = yesAsks.find((level) => level.size > 0)?.priceDollars ?? null
  const noPrice = noAsks.find((level) => level.size > 0)?.priceDollars ?? null
  if (yesPrice == null && noPrice == null) {
    return null
  }

  const edge =
    yesPrice != null && noPrice != null && yesFeeBps != null && noFeeBps != null
      ? 1 - yesPrice * (1 + Math.max(0, yesFeeBps) / 10_000) - noPrice * (1 + Math.max(0, noFeeBps) / 10_000)
      : null

  return { yesPrice, noPrice, edge }
}

const KUEST_ORDER_SHARE_SCALE = 1_000_000
const KUEST_ORDER_SHARE_SCALE_BIGINT = BigInt(KUEST_ORDER_SHARE_SCALE)

function normalizeExecutableShares(shares: number) {
  if (!Number.isFinite(shares) || shares <= 0) {
    return 0
  }
  return Math.floor((shares + Number.EPSILON) * KUEST_ORDER_SHARE_SCALE) / KUEST_ORDER_SHARE_SCALE
}

function getKuestFokMaximumCost(price: number, shares: number) {
  const priceMicro = BigInt(toMicro(price))
  const sharesMicro = BigInt(toMicro(shares))
  const makerAmountMicro =
    (priceMicro * sharesMicro + KUEST_ORDER_SHARE_SCALE_BIGINT - 1n) / KUEST_ORDER_SHARE_SCALE_BIGINT
  return Number(makerAmountMicro) / MICRO_UNIT
}

function trimOutcomeArbitrageQuote(quote: OutcomeArbitrageQuote, targetShares: number): OutcomeArbitrageQuote | null {
  let remainingShares = normalizeExecutableShares(targetShares)
  const segments: OutcomeArbitrageSegment[] = []

  for (const segment of quote.segments) {
    const shares = Math.min(segment.shares, remainingShares)
    if (!(shares > 0)) {
      break
    }
    segments.push({ ...segment, shares })
    remainingShares -= shares
  }

  const terminalSegment = segments.at(-1)
  if (!terminalSegment) {
    return null
  }

  const shares = segments.reduce((total, segment) => total + segment.shares, 0)
  const yesCost = segments.reduce((total, segment) => total + segment.shares * segment.yesUnitCost, 0)
  const noCost = segments.reduce((total, segment) => total + segment.shares * segment.noUnitCost, 0)
  const totalCost = yesCost + noCost

  return {
    ...quote,
    segments,
    shares,
    yesCost,
    noCost,
    totalCost,
    payout: shares,
    profit: shares - totalCost,
    edge: shares > 0 ? (shares - totalCost) / shares : 0,
    yesOrder: {
      price: terminalSegment.yesPrice,
      maximumCost: getKuestFokMaximumCost(terminalSegment.yesPrice, shares),
    },
    noOrder: {
      price: terminalSegment.noPrice,
      maximumCost: getKuestFokMaximumCost(terminalSegment.noPrice, shares),
    },
  }
}

function getMaximumRequiredBalance(quote: OutcomeArbitrageQuote) {
  const yesFees = Math.max(
    0,
    quote.yesCost - quote.segments.reduce((total, segment) => total + segment.shares * segment.yesPrice, 0),
  )
  const noFees = Math.max(
    0,
    quote.noCost - quote.segments.reduce((total, segment) => total + segment.shares * segment.noPrice, 0),
  )
  return quote.yesOrder.maximumCost + quote.noOrder.maximumCost + yesFees + noFees
}

export function constrainOutcomeArbitrageQuoteForKuestFok(
  quote: OutcomeArbitrageQuote,
  kuestBalance = Number.POSITIVE_INFINITY,
) {
  if (kuestBalance === Number.POSITIVE_INFINITY) {
    return quote
  }
  if (!Number.isFinite(kuestBalance) || kuestBalance < 0) {
    return null
  }
  if (getMaximumRequiredBalance(quote) <= kuestBalance) {
    return quote
  }

  let lowShares = 0
  let highShares = quote.shares
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middleShares = (lowShares + highShares) / 2
    const candidate = trimOutcomeArbitrageQuote(quote, middleShares)
    if (candidate && getMaximumRequiredBalance(candidate) <= kuestBalance) {
      lowShares = candidate.shares
    } else {
      highShares = middleShares
    }
  }

  const constrained = trimOutcomeArbitrageQuote(quote, lowShares)
  return constrained?.profit && constrained.profit > 0 ? constrained : null
}

export function buildOutcomeArbitrageQuote({
  yesTokenId,
  noTokenId,
  yesAsks,
  noAsks,
  kuestBalance = Number.POSITIVE_INFINITY,
  yesFeeBps = 0,
  noFeeBps = 0,
}: {
  yesTokenId: string
  noTokenId: string
  yesAsks: NormalizedBookLevel[]
  noAsks: NormalizedBookLevel[]
  kuestBalance?: number
  yesFeeBps?: number
  noFeeBps?: number
}): OutcomeArbitrageQuote | null {
  let yesIndex = 0
  let noIndex = 0
  let yesLevelRemaining = yesAsks[0]?.size ?? 0
  let noLevelRemaining = noAsks[0]?.size ?? 0
  const segments: OutcomeArbitrageSegment[] = []

  while (yesIndex < yesAsks.length && noIndex < noAsks.length) {
    const yesLevel = yesAsks[yesIndex]
    const noLevel = noAsks[noIndex]
    if (!yesLevel || !noLevel) {
      break
    }

    const yesUnitCost = yesLevel.priceDollars * (1 + Math.max(0, yesFeeBps) / 10_000)
    const noUnitCost = noLevel.priceDollars * (1 + Math.max(0, noFeeBps) / 10_000)
    if (yesUnitCost + noUnitCost >= 1) {
      break
    }

    const shares = Math.min(yesLevelRemaining, noLevelRemaining)
    if (!(shares > 0)) {
      break
    }

    segments.push({
      shares,
      yesPrice: yesLevel.priceDollars,
      noPrice: noLevel.priceDollars,
      yesUnitCost,
      noUnitCost,
    })
    yesLevelRemaining -= shares
    noLevelRemaining -= shares

    if (yesLevelRemaining <= 1e-8) {
      yesIndex += 1
      yesLevelRemaining = yesAsks[yesIndex]?.size ?? 0
    }
    if (noLevelRemaining <= 1e-8) {
      noIndex += 1
      noLevelRemaining = noAsks[noIndex]?.size ?? 0
    }
  }

  if (segments.length === 0) {
    return null
  }

  const rawQuote = trimOutcomeArbitrageQuote(
    {
      yesTokenId,
      noTokenId,
      edge: 0,
      shares: 0,
      yesCost: 0,
      noCost: 0,
      totalCost: 0,
      payout: 0,
      profit: 0,
      segments,
      yesOrder: { price: 0, maximumCost: 0 },
      noOrder: { price: 0, maximumCost: 0 },
    },
    segments.reduce((total, segment) => total + segment.shares, 0),
  )

  return rawQuote ? constrainOutcomeArbitrageQuoteForKuestFok(rawQuote, kuestBalance) : null
}

export function scaleOutcomeArbitrageQuote(quote: OutcomeArbitrageQuote, percent: number) {
  return trimOutcomeArbitrageQuote(quote, (quote.shares * Math.min(100, Math.max(0, percent))) / 100)
}

export function findMinimumExecutableOutcomeArbitrageQuote(
  quote: OutcomeArbitrageQuote,
  {
    minimumShares,
    minimumOrderAmount,
  }: {
    minimumShares: number
    minimumOrderAmount: number
  },
) {
  function meetsMinimum(candidate: OutcomeArbitrageQuote | null) {
    return Boolean(
      candidate &&
      candidate.shares >= minimumShares &&
      candidate.yesOrder.maximumCost >= minimumOrderAmount &&
      candidate.noOrder.maximumCost >= minimumOrderAmount,
    )
  }

  if (!meetsMinimum(quote)) {
    return null
  }

  let lowShares = 0
  let highShares = quote.shares
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middleShares = (lowShares + highShares) / 2
    const candidate = trimOutcomeArbitrageQuote(quote, middleShares)
    if (meetsMinimum(candidate)) {
      highShares = candidate?.shares ?? middleShares
    } else {
      lowShares = middleShares
    }
  }

  const firstShareUnit = Math.max(1, Math.floor(lowShares * KUEST_ORDER_SHARE_SCALE) - 1)
  const lastShareUnit = Math.min(
    Math.ceil(quote.shares * KUEST_ORDER_SHARE_SCALE),
    Math.ceil(highShares * KUEST_ORDER_SHARE_SCALE) + 2,
  )
  for (let shareUnits = firstShareUnit; shareUnits <= lastShareUnit; shareUnits += 1) {
    const candidate = trimOutcomeArbitrageQuote(quote, shareUnits / KUEST_ORDER_SHARE_SCALE)
    if (meetsMinimum(candidate)) {
      return candidate
    }
  }

  return quote
}

import type { Market } from '@/types'
import {
  inferResolvedTweetMarketOutcome,
  isTweetMarketsEvent,
  parseTweetMarketRange,
  resolveXTrackerSource,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventTweetMarkets'
import { resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators } from '@/lib/binary-outcome-resolution'
import { OUTCOME_INDEX } from '@/lib/constants'

export type ResolvedBinaryOutcomeIndex = typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO

interface ResolveEventCardResolvedOutcomeOptions {
  isTweetMarketEvent: boolean
  isTweetMarketFinal: boolean
  totalCount: number | null | undefined
}

interface ResolvedXTrackerCandidateEvent {
  title?: string | null
  slug?: string | null
  tags: Array<{ name?: string | null, slug?: string | null }>
  markets: Array<Pick<Market, 'short_title' | 'title' | 'slug' | 'resolution_source' | 'resolution_source_url'>>
}

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function inferResolvedRangeOutcomeByValue(
  market: Pick<Market, 'short_title' | 'title' | 'slug'>,
  resolvedValue: number | null | undefined,
) {
  if (typeof resolvedValue !== 'number' || !Number.isFinite(resolvedValue)) {
    return null
  }

  const range = parseTweetMarketRange(market)
  if (!range) {
    return null
  }

  const isWithinLowerBound = range.minInclusive == null || resolvedValue >= range.minInclusive
  const isWithinUpperBound = range.maxInclusive == null || resolvedValue <= range.maxInclusive
  return isWithinLowerBound && isWithinUpperBound
    ? OUTCOME_INDEX.YES
    : OUTCOME_INDEX.NO
}

function normalizeComparableText(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

export function shouldUseResolvedXTracker(event: ResolvedXTrackerCandidateEvent) {
  const hasRangeBasedMarkets = event.markets.some(market => parseTweetMarketRange(market) != null)
  if (!hasRangeBasedMarkets) {
    return false
  }

  if (isTweetMarketsEvent(event) || resolveXTrackerSource(event)) {
    return true
  }

  const searchableText = [
    event.title,
    event.slug,
  ]
    .map(normalizeComparableText)
    .join(' ')

  return /\btweets?\b/.test(searchableText)
}

export function resolveBinaryWinningOutcomeIndex(market: Pick<Market, 'outcomes' | 'condition'>): ResolvedBinaryOutcomeIndex | null {
  const explicitWinner = market.outcomes.find(outcome => outcome.is_winning_outcome)
  if (explicitWinner && (explicitWinner.outcome_index === OUTCOME_INDEX.YES || explicitWinner.outcome_index === OUTCOME_INDEX.NO)) {
    return explicitWinner.outcome_index
  }

  return resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators(market.condition?.payout_numerators)
}

export function resolveEventCardResolvedOutcomeIndex(
  market: Market,
  {
    isTweetMarketEvent,
    isTweetMarketFinal,
    totalCount,
  }: ResolveEventCardResolvedOutcomeOptions,
): ResolvedBinaryOutcomeIndex | null {
  const explicitOutcomeIndex = resolveBinaryWinningOutcomeIndex(market)
  if (explicitOutcomeIndex != null) {
    return explicitOutcomeIndex
  }

  const rangeOutcomeIndex = inferResolvedRangeOutcomeByValue(
    market,
    toFiniteNumber(market.condition?.resolution_price),
  )
  if (rangeOutcomeIndex != null) {
    return rangeOutcomeIndex
  }

  if (!isTweetMarketEvent) {
    return null
  }

  return inferResolvedTweetMarketOutcome(market, totalCount, isTweetMarketFinal)
}

export function resolveBinaryOutcomeByIndex(
  market: Pick<Market, 'outcomes'>,
  outcomeIndex: ResolvedBinaryOutcomeIndex | null,
) {
  if (outcomeIndex == null) {
    return null
  }

  return market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)
    ?? market.outcomes[outcomeIndex]
    ?? null
}

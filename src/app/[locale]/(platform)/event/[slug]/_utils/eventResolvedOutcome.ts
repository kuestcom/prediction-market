import type { Event } from '@/types'
import { inferResolvedTweetMarketOutcome, parseTweetMarketRange } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventTweetMarkets'
import { resolveWinningOutcomeIndexForBinaryMarket } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolved-order-panel-market'
import { OUTCOME_INDEX } from '@/lib/constants'

type EventMarket = Event['markets'][number]

interface ResolveEventResolvedOutcomeOptions {
  isTweetMarketEvent?: boolean
  isTweetMarketFinal?: boolean
  totalCount?: number | null
}

function isMarketResolved(market: EventMarket) {
  return Boolean(market.is_resolved || market.condition?.resolved)
}

function normalizeComparableText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

function normalizeNumericRangeInput(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/degrees?/g, '')
    .replace(/°/g, '')
    ?? ''
}

function hasBinaryYesNoOutcomes(market: EventMarket) {
  const normalizedOutcomeTexts = new Set(
    market.outcomes.map(outcome => normalizeComparableText(outcome.outcome_text)),
  )

  return normalizedOutcomeTexts.has('yes') && normalizedOutcomeTexts.has('no')
}

function parseNumericRangeValue(value: string | null | undefined) {
  const normalized = normalizeNumericRangeInput(value)
  if (!normalized) {
    return null
  }

  const exactMatch = normalized.match(/^(-?\d+(?:\.\d+)?)c?$/)
  if (exactMatch) {
    const numericValue = Number.parseFloat(exactMatch[1] ?? '')
    if (Number.isFinite(numericValue)) {
      return {
        minInclusive: numericValue,
        maxInclusive: numericValue,
      }
    }
  }

  const belowMatch = normalized.match(/^(-?\d+(?:\.\d+)?)c?or(?:below|lower)$/)
  if (belowMatch) {
    const numericValue = Number.parseFloat(belowMatch[1] ?? '')
    if (Number.isFinite(numericValue)) {
      return {
        minInclusive: null,
        maxInclusive: numericValue,
      }
    }
  }

  const aboveMatch = normalized.match(/^(-?\d+(?:\.\d+)?)c?or(?:higher|above)$/)
  if (aboveMatch) {
    const numericValue = Number.parseFloat(aboveMatch[1] ?? '')
    if (Number.isFinite(numericValue)) {
      return {
        minInclusive: numericValue,
        maxInclusive: null,
      }
    }
  }

  return null
}

function parseEventNumericRange(market: Pick<EventMarket, 'short_title' | 'title' | 'slug'>) {
  return parseTweetMarketRange(market)
    ?? parseNumericRangeValue(market.short_title)
    ?? parseNumericRangeValue(market.title)
}

function inferResolvedRangeOutcomeByValue(
  market: Pick<EventMarket, 'short_title' | 'title' | 'slug'>,
  resolvedValue: number | null | undefined,
) {
  if (typeof resolvedValue !== 'number' || !Number.isFinite(resolvedValue)) {
    return null
  }

  const range = parseEventNumericRange(market)
  if (!range) {
    return null
  }

  const isWithinLowerBound = range.minInclusive == null || resolvedValue >= range.minInclusive
  const isWithinUpperBound = range.maxInclusive == null || resolvedValue <= range.maxInclusive
  return isWithinLowerBound && isWithinUpperBound
    ? OUTCOME_INDEX.YES
    : OUTCOME_INDEX.NO
}

function parseSportsScore(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\D+(\d+)/)
  if (!match) {
    return null
  }

  const homeScore = Number.parseInt(match[1] ?? '', 10)
  const awayScore = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    return null
  }

  return { homeScore, awayScore }
}

function resolvePrimaryTeams(event: Event) {
  const teams = (event.sports_teams ?? [])
    .map(team => ({
      name: team.name?.trim() ?? '',
      abbreviation: team.abbreviation?.trim() ?? '',
      hostStatus: team.host_status?.trim().toLowerCase() ?? '',
    }))
    .filter(team => team.name.length > 0)

  const homeTeam = teams.find(team => team.hostStatus === 'home') ?? teams[0] ?? null
  const awayTeam = teams.find(team => team.hostStatus === 'away') ?? teams.find(team => team !== homeTeam) ?? null

  return { homeTeam, awayTeam }
}

function doesTextMatchTeam(value: string | null | undefined, team: ReturnType<typeof resolvePrimaryTeams>['homeTeam']) {
  if (!value || !team) {
    return false
  }

  const haystack = normalizeComparableText(value)
  if (!haystack) {
    return false
  }

  const normalizedName = normalizeComparableText(team.name)
  if (normalizedName && haystack.includes(normalizedName)) {
    return true
  }

  const normalizedAbbreviation = normalizeComparableText(team.abbreviation)
  if (!normalizedAbbreviation) {
    return false
  }

  const haystackTokens = new Set(haystack.split(' ').filter(Boolean))
  return haystackTokens.has(normalizedAbbreviation)
}

function isMoneylineLikeMarket(market: EventMarket) {
  const normalizedType = normalizeComparableText(market.sports_market_type)
  if (
    normalizedType.includes('moneyline')
    || normalizedType.includes('match winner')
    || normalizedType === '1x2'
  ) {
    return true
  }

  return false
}

function inferSportsMoneylineOutcomeFromScore(event: Event, market: EventMarket) {
  if (!hasBinaryYesNoOutcomes(market) || !isMoneylineLikeMarket(market)) {
    return null
  }

  const score = parseSportsScore(event.sports_score)
  if (!score) {
    return null
  }

  const descriptor = [
    market.sports_group_item_title,
    market.short_title,
    market.title,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
  const normalizedDescriptor = normalizeComparableText(descriptor)
  if (!normalizedDescriptor) {
    return null
  }

  if (normalizedDescriptor.includes('draw')) {
    return score.homeScore === score.awayScore ? OUTCOME_INDEX.YES : OUTCOME_INDEX.NO
  }

  const { homeTeam, awayTeam } = resolvePrimaryTeams(event)
  if (!homeTeam || !awayTeam || score.homeScore === score.awayScore) {
    return null
  }

  const winningTeam = score.homeScore > score.awayScore ? homeTeam : awayTeam
  const losingTeam = winningTeam === homeTeam ? awayTeam : homeTeam

  if (doesTextMatchTeam(descriptor, winningTeam)) {
    return OUTCOME_INDEX.YES
  }

  if (doesTextMatchTeam(descriptor, losingTeam)) {
    return OUTCOME_INDEX.NO
  }

  return null
}

function inferEliminatedNumericRangeOutcomeFromEventState(event: Event, market: EventMarket) {
  if (
    event.status === 'resolved'
    || !isMarketResolved(market)
    || !hasBinaryYesNoOutcomes(market)
    || !parseEventNumericRange(market)
  ) {
    return null
  }

  const hasUnresolvedSibling = event.markets.some(candidate =>
    candidate.condition_id !== market.condition_id
    && !isMarketResolved(candidate),
  )

  return hasUnresolvedSibling ? OUTCOME_INDEX.NO : null
}

export function resolveEventResolvedOutcomeIndex(
  event: Event,
  market: EventMarket,
  options: ResolveEventResolvedOutcomeOptions = {},
) {
  const explicitOutcomeIndex = resolveWinningOutcomeIndexForBinaryMarket(market)
  if (explicitOutcomeIndex != null) {
    return explicitOutcomeIndex
  }

  const numericResolutionPrice = market.condition?.resolution_price == null
    ? null
    : Number(market.condition.resolution_price)
  const rangeOutcomeIndex = inferResolvedRangeOutcomeByValue(market, numericResolutionPrice)
  if (rangeOutcomeIndex != null) {
    return rangeOutcomeIndex
  }

  const sportsMoneylineOutcomeIndex = inferSportsMoneylineOutcomeFromScore(event, market)
  if (sportsMoneylineOutcomeIndex != null) {
    return sportsMoneylineOutcomeIndex
  }

  if (options.isTweetMarketEvent) {
    const tweetOutcomeIndex = inferResolvedTweetMarketOutcome(
      market,
      options.totalCount,
      Boolean(options.isTweetMarketFinal),
    )
    if (tweetOutcomeIndex != null) {
      return tweetOutcomeIndex
    }
  }

  return inferEliminatedNumericRangeOutcomeFromEventState(event, market)
}

export function toResolutionTimelineOutcome(outcomeIndex: 0 | 1 | null) {
  if (outcomeIndex === OUTCOME_INDEX.YES) {
    return 'yes' as const
  }

  if (outcomeIndex === OUTCOME_INDEX.NO) {
    return 'no' as const
  }

  return null
}

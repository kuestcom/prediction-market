import type { Event } from '@/types'
import {
  normalizeComparableText,
  parseSportsScore,
  resolveEventTeams,
  resolveTeamNameFromText,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/sports-resolution-helpers'
import { resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators } from '@/lib/binary-outcome-resolution'
import { OUTCOME_INDEX } from '@/lib/constants'

const RESOLUTION_PRICE_TOLERANCE = 1e-9
type Market = Event['markets'][number]
type SportsResolvedDisplayKind
  = | 'moneyline'
    | 'spread'
    | 'total'
    | 'btts'
    | 'exactScore'
    | 'halftimeResult'

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function canonicalizeOutcomeLabel(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  if (/^yes$/i.test(trimmed)) {
    return 'Yes'
  }
  if (/^no$/i.test(trimmed)) {
    return 'No'
  }
  if (/^over$/i.test(trimmed)) {
    return 'Over'
  }
  if (/^under$/i.test(trimmed)) {
    return 'Under'
  }

  return trimmed
}

function resolveMarketDescriptor(market: Market | null | undefined) {
  return market?.sports_group_item_title?.trim()
    || market?.short_title?.trim()
    || market?.title?.trim()
    || ''
}

function hasSportsContext(market: Market | null | undefined) {
  return Boolean(
    market?.sports_market_type?.trim()
    || market?.sports_group_item_title?.trim()
    || market?.sports_game_start_time
    || market?.sports_start_time,
  )
}

export function isExactScoreSportsMarket(market: Market | null | undefined) {
  const normalizedType = normalizeComparableText(market?.sports_market_type)
  if (normalizedType.includes('exact score')) {
    return true
  }

  const descriptorText = normalizeComparableText(
    [
      market?.sports_group_item_title,
      market?.short_title,
      market?.title,
      market?.slug,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' '),
  )

  return descriptorText.includes('exact score')
    || descriptorText.includes('exact score any other score')
    || descriptorText.includes('exact score 0 0')
    || descriptorText.includes('exact score 1 0')
    || descriptorText.includes('exact score 0 1')
    || descriptorText.includes('exact score 1 1')
}

function resolveSportsResolvedDisplayKind(market: Market | null | undefined): SportsResolvedDisplayKind | null {
  const normalizedType = normalizeComparableText(market?.sports_market_type)
  const descriptorText = normalizeComparableText(
    [
      market?.sports_group_item_title,
      market?.short_title,
      market?.title,
      ...(market?.outcomes?.map(outcome => outcome.outcome_text) ?? []),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' '),
  )
  const rawDescriptorText = [
    market?.sports_group_item_title,
    market?.short_title,
    market?.title,
    market?.slug,
    ...(market?.outcomes?.map(outcome => outcome.outcome_text) ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')

  if (
    normalizedType.includes('exact score')
    || normalizeComparableText(rawDescriptorText).includes('exact score')
  ) {
    return 'exactScore'
  }
  if (
    normalizedType.includes('halftime result')
    || normalizeComparableText(rawDescriptorText).includes('halftime result')
  ) {
    return 'halftimeResult'
  }
  if (
    normalizedType.includes('both teams to score')
    || normalizedType.includes('btts')
    || descriptorText.includes('both teams to score')
  ) {
    return 'btts'
  }
  if (normalizedType.includes('spread') || normalizedType.includes('handicap')) {
    return 'spread'
  }
  if (normalizedType.includes('total') || normalizedType.includes('over under')) {
    return 'total'
  }
  if (
    normalizedType.includes('moneyline')
    || normalizedType.includes('match winner')
    || normalizedType === '1x2'
  ) {
    return 'moneyline'
  }
  if (/\bover\b/.test(descriptorText) || /\bunder\b/.test(descriptorText)) {
    return 'total'
  }
  if (hasSportsContext(market) && /[+-]\s*\d/.test(rawDescriptorText)) {
    return 'spread'
  }

  return market?.sports_market_type ? 'moneyline' : null
}

function resolveExactScoreDescriptor(market: Market | null | undefined) {
  return resolveMarketDescriptor(market)
}

function parseExactScoreDescriptor(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\s*[-:]\s*(\d+)/)
  if (!match) {
    return null
  }

  const team1 = Number.parseInt(match[1] ?? '', 10)
  const team2 = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isFinite(team1) || !Number.isFinite(team2)) {
    return null
  }

  return { team1, team2 }
}

function isAnyOtherScoreDescriptor(value: string | null | undefined) {
  return normalizeComparableText(value).includes('any other score')
}

function extractUnsignedLineFromText(value: string | null | undefined) {
  const match = value?.match(/(\d+(?:\.\d+)?)/)
  return match?.[1] ?? null
}

function extractSignedLineFromText(value: string | null | undefined) {
  const match = value?.match(/([+-]\s*\d+(?:\.\d+)?)/)
  return match?.[1]?.replace(/\s+/g, '') ?? null
}

function resolveMarketSubjectLabel(market: Market | null | undefined, event: Event | null | undefined) {
  if (!market) {
    return null
  }

  const descriptor = resolveMarketDescriptor(market)
  const normalizedDescriptor = normalizeComparableText(descriptor)
  const { homeTeam, awayTeam } = resolveEventTeams(event)

  if (
    normalizedDescriptor === 'draw'
    || normalizedDescriptor === 'tie'
    || normalizedDescriptor === 'x'
    || market.slug.endsWith('-draw')
  ) {
    return 'Draw'
  }

  if (normalizedDescriptor === 'home' || market.slug.endsWith('-home')) {
    return homeTeam?.name ?? descriptor ?? null
  }

  if (normalizedDescriptor === 'away' || market.slug.endsWith('-away')) {
    return awayTeam?.name ?? descriptor ?? null
  }

  const matchedTeamName = resolveTeamNameFromText(descriptor, event)
  if (matchedTeamName) {
    return matchedTeamName
  }

  const cleanedDescriptor = descriptor
    .replace(/^(?:moneyline|halftime result|match winner)\s*:\s*/i, '')
    .trim()

  return cleanedDescriptor || null
}

function resolveWinningGroupedSportsMarket(params: {
  event: Event | null | undefined
  selectedMarket: Market | null | undefined
  kind: Extract<SportsResolvedDisplayKind, 'moneyline' | 'halftimeResult'>
}) {
  const { event, selectedMarket, kind } = params
  const relatedMarkets = (event?.markets ?? []).filter(market => resolveSportsResolvedDisplayKind(market) === kind)
  if (relatedMarkets.length === 0) {
    return null
  }

  const winningMarket = relatedMarkets.find(
    market => resolveWinningOutcomeIndexForBinaryMarket(market) === OUTCOME_INDEX.YES,
  )

  return winningMarket ?? selectedMarket ?? null
}

function resolveSpreadDisplayLabels(params: {
  event: Event | null | undefined
  market: Market | null | undefined
  resolvedOutcomeText: string | null
}) {
  const { event, market, resolvedOutcomeText } = params
  const sourceLabel = resolvedOutcomeText?.trim() || resolveMarketDescriptor(market)
  if (!sourceLabel) {
    return {
      outcomeLabel: null,
      marketTitle: null,
    }
  }

  const line = extractSignedLineFromText(sourceLabel)
  const subjectSource = sourceLabel
    .replace(/\(\s*[+-]\s*\d+(?:\.\d+)?\s*\)/g, ' ')
    .replace(/[+-]\s*\d+(?:\.\d+)?/g, ' ')
    .replace(/\b(?:spread|handicap)\b/gi, ' ')
    .replace(/[:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const subjectLabel = resolveTeamNameFromText(subjectSource, event)
    || resolveMarketSubjectLabel(market, event)
    || subjectSource
    || null
  const marketTitle = line && subjectLabel
    ? `${subjectLabel} (${line})`
    : sourceLabel.replace(/\s+/g, ' ').trim()

  return {
    outcomeLabel: subjectLabel,
    marketTitle,
  }
}

function resolveTotalDisplayTitle(market: Market | null | undefined) {
  const combinedText = [
    market?.sports_group_item_title,
    market?.short_title,
    market?.title,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
  const line = extractUnsignedLineFromText(combinedText)
  if (line) {
    return `O/U ${line}`
  }

  const descriptor = resolveMarketDescriptor(market)
  if (!descriptor) {
    return null
  }

  return descriptor
    .replace(/^totals?\s+/i, 'O/U ')
    .trim()
}

function resolveExactScoreDisplayTitle(market: Market | null | undefined) {
  const descriptor = resolveExactScoreDescriptor(market)
  if (!descriptor) {
    return null
  }

  if (/^exact score\s*:/i.test(descriptor)) {
    return descriptor.replace(/\s+/g, ' ').trim()
  }

  return `Exact Score: ${descriptor}`
}

export function resolveWinningOutcomeIndexForBinaryMarket(
  market: Market | null | undefined,
) {
  if (!market) {
    return null
  }

  const explicitWinner = market.outcomes?.find(outcome => outcome.is_winning_outcome)
  if (explicitWinner && (explicitWinner.outcome_index === OUTCOME_INDEX.YES || explicitWinner.outcome_index === OUTCOME_INDEX.NO)) {
    return explicitWinner.outcome_index
  }

  const yesOutcome = market.outcomes?.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
    ?? market.outcomes?.[OUTCOME_INDEX.YES]
  const noOutcome = market.outcomes?.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)
    ?? market.outcomes?.[OUTCOME_INDEX.NO]
  const yesPayout = toFiniteNumber(yesOutcome?.payout_value)
  const noPayout = toFiniteNumber(noOutcome?.payout_value)
  if (yesPayout != null || noPayout != null) {
    const safeYesPayout = yesPayout ?? Number.NEGATIVE_INFINITY
    const safeNoPayout = noPayout ?? Number.NEGATIVE_INFINITY

    if (safeYesPayout > safeNoPayout && safeYesPayout > 0) {
      return OUTCOME_INDEX.YES
    }
    if (safeNoPayout > safeYesPayout && safeNoPayout > 0) {
      return OUTCOME_INDEX.NO
    }
  }

  const yesBuyPrice = toFiniteNumber(yesOutcome?.buy_price)
  const noBuyPrice = toFiniteNumber(noOutcome?.buy_price)
  if (yesBuyPrice != null && noBuyPrice != null) {
    if (Math.abs(yesBuyPrice - 1) <= RESOLUTION_PRICE_TOLERANCE && Math.abs(noBuyPrice) <= RESOLUTION_PRICE_TOLERANCE) {
      return OUTCOME_INDEX.YES
    }
    if (Math.abs(noBuyPrice - 1) <= RESOLUTION_PRICE_TOLERANCE && Math.abs(yesBuyPrice) <= RESOLUTION_PRICE_TOLERANCE) {
      return OUTCOME_INDEX.NO
    }
  }

  const marketPrice = toFiniteNumber(market.price)
  if (marketPrice != null) {
    if (Math.abs(marketPrice - 1) <= RESOLUTION_PRICE_TOLERANCE) {
      return OUTCOME_INDEX.YES
    }
    if (Math.abs(marketPrice) <= RESOLUTION_PRICE_TOLERANCE) {
      return OUTCOME_INDEX.NO
    }
  }

  const rawResolutionPrice = market.condition?.resolution_price
  if (rawResolutionPrice != null) {
    const resolutionPrice = Number(rawResolutionPrice)
    if (Number.isFinite(resolutionPrice)) {
      if (Math.abs(resolutionPrice - 1) <= RESOLUTION_PRICE_TOLERANCE) {
        return OUTCOME_INDEX.YES
      }
      if (Math.abs(resolutionPrice) <= RESOLUTION_PRICE_TOLERANCE) {
        return OUTCOME_INDEX.NO
      }
    }
  }

  return resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators(market.condition?.payout_numerators)
}

export function resolveResolvedOrderPanelMarket(params: {
  event: Event | null | undefined
  selectedMarket: Market | null | undefined
}) {
  const { event, selectedMarket } = params

  if (!selectedMarket) {
    return {
      market: null,
      resolvedOutcomeIndex: null,
    }
  }

  const isExactScoreMarket = isExactScoreSportsMarket(selectedMarket)
  if (!isExactScoreMarket) {
    return {
      market: selectedMarket,
      resolvedOutcomeIndex: resolveWinningOutcomeIndexForBinaryMarket(selectedMarket),
    }
  }

  const exactScoreMarkets = (event?.markets ?? []).filter(market => isExactScoreSportsMarket(market))

  const winningExactScoreMarket = exactScoreMarkets.find(
    market => resolveWinningOutcomeIndexForBinaryMarket(market) === OUTCOME_INDEX.YES,
  ) ?? null

  if (winningExactScoreMarket) {
    return {
      market: winningExactScoreMarket,
      resolvedOutcomeIndex: OUTCOME_INDEX.YES,
    }
  }

  const finalScore = parseSportsScore(event?.sports_score)
  if (finalScore) {
    const exactScoreMatch = exactScoreMarkets.find((market) => {
      const descriptorScore = parseExactScoreDescriptor(resolveExactScoreDescriptor(market))
      return descriptorScore?.team1 === finalScore.team1 && descriptorScore?.team2 === finalScore.team2
    }) ?? null

    if (exactScoreMatch) {
      return {
        market: exactScoreMatch,
        resolvedOutcomeIndex: OUTCOME_INDEX.YES,
      }
    }

    const anyOtherScoreMarket = exactScoreMarkets.find(market =>
      isAnyOtherScoreDescriptor(resolveExactScoreDescriptor(market)),
    ) ?? null

    if (anyOtherScoreMarket) {
      return {
        market: anyOtherScoreMarket,
        resolvedOutcomeIndex: OUTCOME_INDEX.YES,
      }
    }
  }

  return {
    market: null,
    resolvedOutcomeIndex: null,
  }
}

export function resolveResolvedOrderPanelDisplay(params: {
  event: Event | null | undefined
  selectedMarket: Market | null | undefined
}) {
  const { event, selectedMarket } = params
  const sportsKind = resolveSportsResolvedDisplayKind(selectedMarket)
  const resolvedState = resolveResolvedOrderPanelMarket(params)

  let displayMarket = resolvedState.market
  let resolvedOutcomeIndex = resolvedState.resolvedOutcomeIndex

  if (sportsKind === 'moneyline' || sportsKind === 'halftimeResult') {
    const winningGroupedMarket = resolveWinningGroupedSportsMarket({
      event,
      selectedMarket,
      kind: sportsKind,
    })
    if (winningGroupedMarket) {
      displayMarket = winningGroupedMarket
      resolvedOutcomeIndex = resolveWinningOutcomeIndexForBinaryMarket(winningGroupedMarket)
        ?? OUTCOME_INDEX.YES
    }
  }

  const resolvedOutcome = displayMarket?.outcomes?.find(
    outcome => outcome.outcome_index === resolvedOutcomeIndex,
  ) ?? null
  const resolvedOutcomeText = resolvedOutcome?.outcome_text?.trim() ?? null

  if (sportsKind === 'moneyline' || sportsKind === 'halftimeResult') {
    return {
      market: displayMarket,
      resolvedOutcomeIndex,
      outcomeLabel: canonicalizeOutcomeLabel(resolvedOutcomeText)
        ?? (resolvedOutcomeIndex === OUTCOME_INDEX.YES ? 'Yes' : resolvedOutcomeIndex === OUTCOME_INDEX.NO ? 'No' : null),
      marketTitle: resolveMarketSubjectLabel(displayMarket, event),
    }
  }

  if (sportsKind === 'spread') {
    const spreadLabels = resolveSpreadDisplayLabels({
      event,
      market: displayMarket,
      resolvedOutcomeText,
    })
    return {
      market: displayMarket,
      resolvedOutcomeIndex,
      outcomeLabel: spreadLabels.outcomeLabel,
      marketTitle: spreadLabels.marketTitle,
    }
  }

  if (sportsKind === 'total') {
    return {
      market: displayMarket,
      resolvedOutcomeIndex,
      outcomeLabel: canonicalizeOutcomeLabel(resolvedOutcomeText),
      marketTitle: resolveTotalDisplayTitle(displayMarket),
    }
  }

  if (sportsKind === 'btts') {
    return {
      market: displayMarket,
      resolvedOutcomeIndex,
      outcomeLabel: canonicalizeOutcomeLabel(resolvedOutcomeText)
        ?? (resolvedOutcomeIndex === OUTCOME_INDEX.YES ? 'Yes' : resolvedOutcomeIndex === OUTCOME_INDEX.NO ? 'No' : null),
      marketTitle: 'Both Teams to Score',
    }
  }

  if (sportsKind === 'exactScore') {
    return {
      market: displayMarket,
      resolvedOutcomeIndex,
      outcomeLabel: canonicalizeOutcomeLabel(resolvedOutcomeText)
        ?? (resolvedOutcomeIndex === OUTCOME_INDEX.YES ? 'Yes' : resolvedOutcomeIndex === OUTCOME_INDEX.NO ? 'No' : null),
      marketTitle: resolveExactScoreDisplayTitle(displayMarket),
    }
  }

  const resolvedYesOutcomeText = displayMarket?.outcomes?.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.YES,
  )?.outcome_text
  const resolvedNoOutcomeText = displayMarket?.outcomes?.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.NO,
  )?.outcome_text
  const selectedMarketResolvedOutcomeIndex = resolveWinningOutcomeIndexForBinaryMarket(selectedMarket)

  return {
    market: displayMarket,
    resolvedOutcomeIndex,
    outcomeLabel: resolvedOutcomeIndex === OUTCOME_INDEX.NO
      ? (canonicalizeOutcomeLabel(resolvedOutcomeText) || canonicalizeOutcomeLabel(resolvedNoOutcomeText) || 'No')
      : resolvedOutcomeIndex === OUTCOME_INDEX.YES
        ? (canonicalizeOutcomeLabel(resolvedOutcomeText) || canonicalizeOutcomeLabel(resolvedYesOutcomeText) || 'Yes')
        : selectedMarketResolvedOutcomeIndex === OUTCOME_INDEX.NO
          ? (canonicalizeOutcomeLabel(resolvedNoOutcomeText) || 'No')
          : selectedMarketResolvedOutcomeIndex === OUTCOME_INDEX.YES
            ? (canonicalizeOutcomeLabel(resolvedYesOutcomeText) || 'Yes')
            : null,
    marketTitle: resolveMarketDescriptor(displayMarket) || null,
  }
}

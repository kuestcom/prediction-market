import type { SportsEventMarketViewKey } from '@/lib/sports-event-slugs'
import type { Event, Market, Outcome, SportsTeam } from '@/types'
import { resolveEventPagePath } from '@/lib/events-routing'
import {
  isSportsMoreMarketsSlug,
  resolveSportsEventMarketViewKey,
  SPORTS_EVENT_MARKET_VIEW_LABELS,
  SPORTS_EVENT_MARKET_VIEW_ORDER,
  stripSportsAuxiliaryEventSuffix,
} from '@/lib/sports-event-slugs'

export interface SportsGamesTeam {
  name: string
  abbreviation: string
  record: string | null
  color: string | null
  logoUrl: string | null
  hostStatus: string | null
}

export interface SportsGamesButton {
  key: string
  conditionId: string
  outcomeIndex: number
  label: string
  cents: number
  color: string | null
  marketType: 'moneyline' | 'spread' | 'total' | 'btts'
  tone: 'team1' | 'team2' | 'draw' | 'over' | 'under' | 'neutral'
}

export interface SportsGamesCard {
  id: string
  event: Event
  slug: string
  eventHref: string
  title: string
  volume: number
  marketsCount: number
  eventCreatedAt: string
  eventResolvedAt: string | null
  startTime: string | null
  week: number | null
  teams: SportsGamesTeam[]
  detailMarkets: Market[]
  defaultConditionId: string | null
  buttons: SportsGamesButton[]
}

export interface SportsGamesCardMarketView {
  key: SportsEventMarketViewKey
  label: string
  card: SportsGamesCard
}

export interface SportsGamesCardGroup {
  key: string
  primaryCard: SportsGamesCard
  marketViewCards: SportsGamesCardMarketView[]
}

function normalizeText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash) ? withHash : null
}

function normalizeTeamRecord(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('(') && trimmed.endsWith(')') && trimmed.length > 2) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function normalizeMarketPriceCents(market: Market) {
  const value = Number.isFinite(market.price)
    ? market.price * 100
    : Number.isFinite(market.probability)
      ? market.probability
      : 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeOutcomePriceCents(
  outcome: Outcome | null | undefined,
  market: Market,
  fallbackIsNoOutcome = false,
) {
  if (outcome && Number.isFinite(outcome.buy_price)) {
    const value = Number(outcome.buy_price) * 100
    return Math.max(0, Math.min(100, Math.round(value)))
  }

  const yesPrice = normalizeMarketPriceCents(market)
  return fallbackIsNoOutcome ? Math.max(0, 100 - yesPrice) : yesPrice
}

function marketDisplayText(market: Market) {
  return [
    market.sports_group_item_title,
    market.short_title,
    market.title,
  ].join(' ')
}

function isDrawMarket(market: Market) {
  return normalizeText(marketDisplayText(market)).includes('draw')
}

function hasMarketSlugSuffix(market: Market, suffix: string) {
  return market.slug?.trim().toLowerCase().endsWith(suffix) ?? false
}

function toTeamButtonLabel(team: SportsGamesTeam | null, fallback: string) {
  if (!team) {
    return fallback
  }

  const normalizedAbbreviation = team.abbreviation
    .trim()
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()

  if (normalizedAbbreviation) {
    return normalizedAbbreviation
  }

  return fallback
}

function doesMarketMatchTeam(market: Market, team: SportsGamesTeam) {
  if (isDrawMarket(market)) {
    return false
  }

  const haystack = normalizeText(marketDisplayText(market))
  if (!haystack) {
    return false
  }

  const normalizedName = normalizeText(team.name)
  if (normalizedName && haystack.includes(normalizedName)) {
    return true
  }

  const normalizedAbbreviation = normalizeText(team.abbreviation)
  if (!normalizedAbbreviation) {
    return false
  }

  const haystackTokens = new Set(haystack.split(' ').filter(Boolean))
  return haystackTokens.has(normalizedAbbreviation)
}

function buildFallbackAbbreviation(teamName: string) {
  return teamName
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
}

function toSportsTeams(event: Event) {
  const logoUrls = event.sports_team_logo_urls ?? []
  const rawTeams = (event.sports_teams ?? []) as SportsTeam[]
  const teams = rawTeams
    .map((team, index): SportsGamesTeam | null => {
      const name = team.name?.trim() ?? ''
      if (!name) {
        return null
      }

      const abbreviation = team.abbreviation?.trim() || buildFallbackAbbreviation(name)
      const logoUrl = team.logo_url?.trim() || logoUrls[index] || null

      return {
        name,
        abbreviation,
        record: normalizeTeamRecord(team.record),
        color: normalizeHexColor(team.color),
        logoUrl,
        hostStatus: team.host_status?.trim() ?? null,
      }
    })
    .filter((team): team is SportsGamesTeam => Boolean(team))

  return teams.sort((a, b) => {
    if (a.hostStatus === 'home' && b.hostStatus !== 'home') {
      return -1
    }
    if (b.hostStatus === 'home' && a.hostStatus !== 'home') {
      return 1
    }
    if (a.hostStatus === 'away' && b.hostStatus !== 'away') {
      return 1
    }
    if (b.hostStatus === 'away' && a.hostStatus !== 'away') {
      return -1
    }
    return 0
  })
}

function toSportsMarketType(market: Market) {
  const normalizedType = normalizeText(market.sports_market_type)
  if (
    normalizedType.includes('both teams to score')
    || normalizedType.includes('btts')
  ) {
    return 'btts' as const
  }

  if (
    normalizedType.includes('moneyline')
    || normalizedType.includes('match winner')
    || normalizedType === '1x2'
  ) {
    return 'moneyline' as const
  }

  if (
    normalizedType.includes('spread')
    || normalizedType.includes('handicap')
  ) {
    return 'spread' as const
  }

  if (
    normalizedType.includes('total')
    || normalizedType.includes('over under')
  ) {
    return 'total' as const
  }

  const marketText = ` ${normalizeText(marketDisplayText(market))} `
  if (marketText.includes(' both teams to score ') || marketText.includes(' btts ')) {
    return 'btts' as const
  }
  if (isDrawMarket(market)) {
    return 'moneyline' as const
  }
  if (/\bover\b/.test(marketText) || /\bunder\b/.test(marketText)) {
    return 'total' as const
  }
  if (/[+-]\s*\d/.test(marketDisplayText(market))) {
    return 'spread' as const
  }

  return null
}

function groupMarketsByType(markets: Market[]) {
  const grouped = {
    moneyline: [] as Market[],
    spread: [] as Market[],
    total: [] as Market[],
    btts: [] as Market[],
    untyped: [] as Market[],
  }

  for (const market of markets) {
    const marketType = toSportsMarketType(market)
    if (marketType === 'moneyline') {
      grouped.moneyline.push(market)
      continue
    }
    if (marketType === 'spread') {
      grouped.spread.push(market)
      continue
    }
    if (marketType === 'total') {
      grouped.total.push(market)
      continue
    }
    if (marketType === 'btts') {
      grouped.btts.push(market)
      continue
    }

    grouped.untyped.push(market)
  }

  return grouped
}

function resolvePrimaryTeams(teams: SportsGamesTeam[]) {
  const homeTeam = teams.find(team => team.hostStatus === 'home') ?? null
  const awayTeam = teams.find(team => team.hostStatus === 'away') ?? null
  const team1 = homeTeam ?? teams[0] ?? null
  const team2 = awayTeam ?? teams.find(team => team !== team1) ?? null

  return { team1, team2 }
}

function doesTextMatchTeam(value: string | null | undefined, team: SportsGamesTeam | null) {
  if (!value || !team) {
    return false
  }

  const haystack = normalizeText(value)
  if (!haystack) {
    return false
  }

  const normalizedName = normalizeText(team.name)
  if (normalizedName && haystack.includes(normalizedName)) {
    return true
  }

  const normalizedAbbreviation = normalizeText(team.abbreviation)
  if (!normalizedAbbreviation) {
    return false
  }

  const haystackTokens = new Set(haystack.split(' ').filter(Boolean))
  return haystackTokens.has(normalizedAbbreviation)
}

function extractSignedLineFromText(value: string) {
  const match = value.match(/([+-]\s*\d+(?:\.\d+)?)/)
  if (!match?.[1]) {
    return null
  }

  return match[1].replace(/\s+/g, '')
}

function extractUnsignedLineFromText(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/)
  return match?.[1] ?? null
}

function formatSignedLine(value: number) {
  const rounded = Math.round(value * 10) / 10
  const display = Number.isInteger(rounded) ? `${rounded.toFixed(1)}` : `${rounded}`
  return value > 0 ? `+${display}` : display
}

function toNumericLine(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveTotalLine(market: Market) {
  const marketText = [market.short_title, market.title]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    || marketDisplayText(market)
  return extractUnsignedLineFromText(marketText)
}

function resolveSpreadSignedLine(market: Market) {
  const directText = [market.short_title, market.title, marketDisplayText(market)]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
  const directLine = extractSignedLineFromText(directText)
  if (directLine) {
    return directLine
  }

  for (const outcome of market.outcomes) {
    const fromOutcome = extractSignedLineFromText(outcome.outcome_text ?? '')
    if (fromOutcome) {
      return fromOutcome
    }
  }

  return null
}

function appendButton(
  buttons: SportsGamesButton[],
  usedButtonKeys: Set<string>,
  market: Market | undefined,
  outcomeIndex: number,
  payload: Pick<SportsGamesButton, 'label' | 'color' | 'marketType' | 'tone'>,
) {
  if (!market || !market.condition_id) {
    return
  }

  const buttonKey = `${market.condition_id}:${outcomeIndex}`
  if (usedButtonKeys.has(buttonKey)) {
    return
  }

  const selectedOutcome = market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)
    ?? market.outcomes[outcomeIndex]
    ?? null

  const isNoOutcome = outcomeIndex === 1
  usedButtonKeys.add(buttonKey)
  buttons.push({
    key: buttonKey,
    conditionId: market.condition_id,
    outcomeIndex,
    label: payload.label,
    cents: normalizeOutcomePriceCents(selectedOutcome, market, isNoOutcome),
    color: payload.color,
    marketType: payload.marketType,
    tone: payload.tone,
  })
}

function buildMoneylineButtons(
  marketsByType: ReturnType<typeof groupMarketsByType>,
  teams: SportsGamesTeam[],
  team1: SportsGamesTeam | null,
  team2: SportsGamesTeam | null,
  usedButtonKeys: Set<string>,
) {
  const candidates = marketsByType.moneyline.length >= 2
    ? marketsByType.moneyline
    : [...marketsByType.moneyline, ...marketsByType.untyped]

  if (candidates.length === 0) {
    return []
  }

  const compositeMarket = candidates.length === 1 ? candidates[0] : null
  if (compositeMarket && compositeMarket.outcomes.length >= 2) {
    const orderedOutcomes = [...compositeMarket.outcomes].sort((a, b) => a.outcome_index - b.outcome_index)
    const buttons: SportsGamesButton[] = []

    orderedOutcomes.forEach((outcome, index) => {
      const outcomeText = outcome.outcome_text?.trim() ?? ''
      const matchedTeam = teams.find(team => doesTextMatchTeam(outcomeText, team)) ?? null
      const normalizedOutcomeText = normalizeText(outcomeText)
      const isDrawOutcome = normalizedOutcomeText.includes('draw')
      const fallbackTeam = index === 0 ? team1 : index === orderedOutcomes.length - 1 ? team2 : null
      const resolvedTeam = matchedTeam ?? fallbackTeam
      const fallbackLabel = resolvedTeam
        ? toTeamButtonLabel(resolvedTeam, outcomeText || 'TEAM')
        : outcomeText.toUpperCase() || 'MARKET'

      appendButton(buttons, usedButtonKeys, compositeMarket, outcome.outcome_index, {
        label: isDrawOutcome ? 'DRAW' : fallbackLabel,
        color: resolvedTeam?.color ?? null,
        marketType: 'moneyline',
        tone: isDrawOutcome
          ? 'draw'
          : resolvedTeam === team1
            ? 'team1'
            : resolvedTeam === team2
              ? 'team2'
              : 'neutral',
      })
    })

    if (buttons.length > 0) {
      return buttons
    }
  }

  const nonDrawMarkets = candidates.filter(market => !isDrawMarket(market))
  const team1Market = team1 ? nonDrawMarkets.find(market => doesMarketMatchTeam(market, team1)) : undefined
  const team2Market = team2 ? nonDrawMarkets.find(market => doesMarketMatchTeam(market, team2)) : undefined
  const drawMarket = candidates.find(market => isDrawMarket(market))

  const buttons: SportsGamesButton[] = []

  appendButton(buttons, usedButtonKeys, team1Market, 0, {
    label: toTeamButtonLabel(team1, 'TEAM 1'),
    color: team1?.color ?? null,
    marketType: 'moneyline',
    tone: 'team1',
  })
  appendButton(buttons, usedButtonKeys, drawMarket, 0, {
    label: 'DRAW',
    color: null,
    marketType: 'moneyline',
    tone: 'draw',
  })
  appendButton(buttons, usedButtonKeys, team2Market, 0, {
    label: toTeamButtonLabel(team2, 'TEAM 2'),
    color: team2?.color ?? null,
    marketType: 'moneyline',
    tone: 'team2',
  })

  for (const market of candidates) {
    if (buttons.length >= 3) {
      break
    }

    if (usedButtonKeys.has(`${market.condition_id}:0`)) {
      continue
    }

    const matchedTeam = teams.find(team => doesMarketMatchTeam(market, team)) ?? null
    const fallbackLabel = isDrawMarket(market)
      ? 'DRAW'
      : matchedTeam
        ? toTeamButtonLabel(matchedTeam, market.short_title || market.title || 'MARKET')
        : (market.short_title || market.title || 'MARKET').toUpperCase()
    const tone = isDrawMarket(market)
      ? 'draw'
      : matchedTeam === team1
        ? 'team1'
        : matchedTeam === team2
          ? 'team2'
          : 'neutral'

    appendButton(buttons, usedButtonKeys, market, 0, {
      label: fallbackLabel,
      color: matchedTeam?.color ?? null,
      marketType: 'moneyline',
      tone,
    })
  }

  return buttons
}

function buildSpreadButtons(
  marketsByType: ReturnType<typeof groupMarketsByType>,
  team1: SportsGamesTeam | null,
  team2: SportsGamesTeam | null,
  usedButtonKeys: Set<string>,
) {
  if (marketsByType.spread.length === 0) {
    return []
  }

  const spreadMarkets = [...marketsByType.spread]
  spreadMarkets.sort((a, b) => {
    const lineA = toNumericLine(resolveSpreadSignedLine(a))
    const lineB = toNumericLine(resolveSpreadSignedLine(b))
    const absA = lineA === null ? Number.POSITIVE_INFINITY : Math.abs(lineA)
    const absB = lineB === null ? Number.POSITIVE_INFINITY : Math.abs(lineB)
    if (absA !== absB) {
      return absA - absB
    }
    if ((lineA ?? 0) !== (lineB ?? 0)) {
      return (lineB ?? 0) - (lineA ?? 0)
    }
    return a.condition_id.localeCompare(b.condition_id)
  })

  const buttons: SportsGamesButton[] = []

  for (const spreadMarket of spreadMarkets) {
    const fallbackSignedLine = toNumericLine(resolveSpreadSignedLine(spreadMarket))
    const orderedOutcomes = [...spreadMarket.outcomes].sort((a, b) => a.outcome_index - b.outcome_index)

    for (const outcome of orderedOutcomes) {
      const outcomeText = outcome.outcome_text ?? ''
      const outcomeLine = toNumericLine(extractSignedLineFromText(outcomeText))
      const resolvedLine = outcomeLine ?? (
        fallbackSignedLine === null
          ? null
          : (outcome.outcome_index === 0 ? fallbackSignedLine : -fallbackSignedLine)
      )

      const matchedTeam = (team1 && doesTextMatchTeam(outcomeText, team1))
        ? team1
        : (team2 && doesTextMatchTeam(outcomeText, team2))
            ? team2
            : null
      const fallbackTeam = outcome.outcome_index === 0 ? team1 : team2
      const resolvedTeam = matchedTeam ?? fallbackTeam

      const label = resolvedTeam
        ? (
            resolvedLine === null
              ? toTeamButtonLabel(resolvedTeam, 'TEAM')
              : `${toTeamButtonLabel(resolvedTeam, 'TEAM')} ${formatSignedLine(resolvedLine)}`
          )
        : (
            resolvedLine === null
              ? (outcomeText.trim().toUpperCase() || 'TEAM')
              : `${(outcomeText.trim().toUpperCase() || 'TEAM')} ${formatSignedLine(resolvedLine)}`
          )

      appendButton(buttons, usedButtonKeys, spreadMarket, outcome.outcome_index, {
        label,
        color: resolvedTeam?.color ?? null,
        marketType: 'spread',
        tone: resolvedTeam === team1 ? 'team1' : resolvedTeam === team2 ? 'team2' : 'neutral',
      })
    }
  }

  return buttons
}

function buildTotalButtons(
  marketsByType: ReturnType<typeof groupMarketsByType>,
  usedButtonKeys: Set<string>,
) {
  if (marketsByType.total.length === 0) {
    return []
  }

  const totalMarkets = [...marketsByType.total]
  totalMarkets.sort((a, b) => {
    const lineA = toNumericLine(resolveTotalLine(a))
    const lineB = toNumericLine(resolveTotalLine(b))
    if ((lineA ?? Number.POSITIVE_INFINITY) !== (lineB ?? Number.POSITIVE_INFINITY)) {
      return (lineA ?? Number.POSITIVE_INFINITY) - (lineB ?? Number.POSITIVE_INFINITY)
    }
    return a.condition_id.localeCompare(b.condition_id)
  })

  const buttons: SportsGamesButton[] = []

  for (const totalMarket of totalMarkets) {
    const fallbackLine = resolveTotalLine(totalMarket)
    const overOutcome = totalMarket.outcomes.find(outcome => /^over$/i.test(outcome.outcome_text?.trim() ?? ''))
      ?? totalMarket.outcomes.find(outcome => outcome.outcome_index === 0)
      ?? null
    const underOutcome = totalMarket.outcomes.find(outcome => /^under$/i.test(outcome.outcome_text?.trim() ?? ''))
      ?? totalMarket.outcomes.find(outcome => outcome.outcome_index !== overOutcome?.outcome_index)
      ?? null

    appendButton(buttons, usedButtonKeys, totalMarket, overOutcome?.outcome_index ?? 0, {
      label: fallbackLine ? `O ${fallbackLine}` : 'O',
      color: null,
      marketType: 'total',
      tone: 'over',
    })
    appendButton(buttons, usedButtonKeys, totalMarket, underOutcome?.outcome_index ?? 1, {
      label: fallbackLine ? `U ${fallbackLine}` : 'U',
      color: null,
      marketType: 'total',
      tone: 'under',
    })
  }

  return buttons
}

function buildBttsButtons(
  marketsByType: ReturnType<typeof groupMarketsByType>,
  usedButtonKeys: Set<string>,
) {
  if (marketsByType.btts.length === 0) {
    return []
  }

  const buttons: SportsGamesButton[] = []
  for (const bttsMarket of marketsByType.btts) {
    const yesOutcome = bttsMarket.outcomes.find(outcome => outcome.outcome_index === 0)
      ?? bttsMarket.outcomes[0]
      ?? null
    const noOutcome = bttsMarket.outcomes.find(outcome => outcome.outcome_index === 1)
      ?? bttsMarket.outcomes.find(outcome => outcome.outcome_index !== yesOutcome?.outcome_index)
      ?? null

    appendButton(buttons, usedButtonKeys, bttsMarket, yesOutcome?.outcome_index ?? 0, {
      label: 'YES',
      color: null,
      marketType: 'btts',
      tone: 'over',
    })
    appendButton(buttons, usedButtonKeys, bttsMarket, noOutcome?.outcome_index ?? 1, {
      label: 'NO',
      color: null,
      marketType: 'btts',
      tone: 'under',
    })
  }

  return buttons
}

function resolveAuxiliaryMarketKind(market: Market) {
  const normalizedType = normalizeText(market.sports_market_type)

  if (normalizedType.includes('exact score')) {
    return 'exactScore' as const
  }

  if (normalizedType.includes('halftime result')) {
    return 'halftimeResult' as const
  }

  return null
}

function buildExactScoreButtons(markets: Market[], usedButtonKeys: Set<string>) {
  if (markets.length === 0) {
    return []
  }

  const firstKind = resolveAuxiliaryMarketKind(markets[0]!)
  if (firstKind !== 'exactScore') {
    return []
  }

  const buttons: SportsGamesButton[] = []

  for (const market of markets) {
    if (resolveAuxiliaryMarketKind(market) !== firstKind) {
      return []
    }

    const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === 0)
      ?? market.outcomes[0]
      ?? null
    const noOutcome = market.outcomes.find(outcome => outcome.outcome_index === 1)
      ?? market.outcomes.find(outcome => outcome.outcome_index !== yesOutcome?.outcome_index)
      ?? null

    appendButton(buttons, usedButtonKeys, market, yesOutcome?.outcome_index ?? 0, {
      label: 'YES',
      color: null,
      marketType: 'moneyline',
      tone: 'over',
    })
    appendButton(buttons, usedButtonKeys, market, noOutcome?.outcome_index ?? 1, {
      label: 'NO',
      color: null,
      marketType: 'moneyline',
      tone: 'under',
    })
  }

  return buttons
}

function buildHalftimeResultButtons(
  markets: Market[],
  teams: SportsGamesTeam[],
  usedButtonKeys: Set<string>,
) {
  if (markets.length === 0) {
    return []
  }

  const firstKind = resolveAuxiliaryMarketKind(markets[0]!)
  if (firstKind !== 'halftimeResult') {
    return []
  }

  for (const market of markets) {
    if (resolveAuxiliaryMarketKind(market) !== firstKind) {
      return []
    }
  }

  const { team1, team2 } = resolvePrimaryTeams(teams)
  const drawMarket = markets.find(market => isDrawMarket(market) || hasMarketSlugSuffix(market, '-draw')) ?? null
  let team1Market = markets.find(market => hasMarketSlugSuffix(market, '-home'))
    ?? (team1 ? markets.find(market => doesMarketMatchTeam(market, team1)) : undefined)
  let team2Market = markets.find(market => hasMarketSlugSuffix(market, '-away'))
    ?? (team2 ? markets.find(market => doesMarketMatchTeam(market, team2)) : undefined)

  const remainingNonDrawMarkets = markets.filter(market =>
    market.condition_id !== drawMarket?.condition_id
    && market.condition_id !== team1Market?.condition_id
    && market.condition_id !== team2Market?.condition_id,
  )

  if (!team1Market) {
    team1Market = remainingNonDrawMarkets.shift()
  }
  if (!team2Market) {
    team2Market = remainingNonDrawMarkets.shift()
  }

  const buttons: SportsGamesButton[] = []

  appendButton(buttons, usedButtonKeys, team1Market, 0, {
    label: toTeamButtonLabel(team1, 'TEAM 1'),
    color: team1?.color ?? null,
    marketType: 'moneyline',
    tone: 'team1',
  })
  appendButton(buttons, usedButtonKeys, drawMarket ?? undefined, 0, {
    label: 'DRAW',
    color: null,
    marketType: 'moneyline',
    tone: 'draw',
  })
  appendButton(buttons, usedButtonKeys, team2Market, 0, {
    label: toTeamButtonLabel(team2, 'TEAM 2'),
    color: team2?.color ?? null,
    marketType: 'moneyline',
    tone: 'team2',
  })

  return buttons
}

function buildButtons(markets: Market[], teams: SportsGamesTeam[]) {
  if (markets.length === 0) {
    return []
  }

  const usedButtonKeys = new Set<string>()
  const exactScoreButtons = buildExactScoreButtons(markets, usedButtonKeys)
  if (exactScoreButtons.length > 0) {
    return exactScoreButtons
  }

  const halftimeResultButtons = buildHalftimeResultButtons(markets, teams, usedButtonKeys)
  if (halftimeResultButtons.length > 0) {
    return halftimeResultButtons
  }

  const marketsByType = groupMarketsByType(markets)
  const { team1, team2 } = resolvePrimaryTeams(teams)

  const moneylineButtons = buildMoneylineButtons(
    marketsByType,
    teams,
    team1,
    team2,
    usedButtonKeys,
  )
  const spreadButtons = buildSpreadButtons(
    marketsByType,
    team1,
    team2,
    usedButtonKeys,
  )
  const totalButtons = buildTotalButtons(marketsByType, usedButtonKeys)
  const bttsButtons = buildBttsButtons(marketsByType, usedButtonKeys)

  return [...moneylineButtons, ...spreadButtons, ...totalButtons, ...bttsButtons]
}

function toDetailMarkets(markets: Market[], buttons: SportsGamesButton[]) {
  const byConditionId = new Map(markets.map(market => [market.condition_id, market] as const))
  const seenConditionIds = new Set<string>()

  return buttons.reduce<Market[]>((detailMarkets, button) => {
    if (seenConditionIds.has(button.conditionId)) {
      return detailMarkets
    }

    const market = byConditionId.get(button.conditionId)
    if (!market) {
      return detailMarkets
    }

    seenConditionIds.add(button.conditionId)
    detailMarkets.push(market)
    return detailMarkets
  }, [])
}

function toSortableTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

function resolveEventGroupKey(event: Event) {
  return stripSportsAuxiliaryEventSuffix(event.sports_event_slug?.trim() || event.slug)
}

function resolveMarketViewKeyForEvent(event: Event): SportsEventMarketViewKey {
  return resolveSportsEventMarketViewKey(event.sports_event_slug?.trim() || event.slug)
}

function mergeMarkets(events: Event[]) {
  const byConditionId = new Map<string, Market>()

  for (const event of events) {
    for (const market of event.markets ?? []) {
      if (!market?.condition_id || byConditionId.has(market.condition_id)) {
        continue
      }
      byConditionId.set(market.condition_id, market)
    }
  }

  return Array.from(byConditionId.values())
}

function sumFiniteValues(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return sum
    }
    return sum + numericValue
  }, 0)
}

function resolveMarketsVolume(markets: Market[]) {
  return sumFiniteValues(markets.map(market => Number(market.volume ?? 0)))
}

function resolveWeek(events: Event[], fallback: number | null) {
  if (fallback !== null) {
    return fallback
  }

  for (const event of events) {
    if (Number.isFinite(event.sports_event_week)) {
      return Number(event.sports_event_week)
    }
  }

  return null
}

function resolveStartTime(events: Event[], fallback: string | null) {
  if (fallback) {
    return fallback
  }

  for (const event of events) {
    const value = event.sports_start_time ?? event.start_date ?? null
    if (value) {
      return value
    }
  }

  return null
}

function resolveEarliestCreatedAt(events: Event[], fallback: string) {
  let earliestTimestamp = Number.POSITIVE_INFINITY
  let earliestValue = fallback

  for (const event of events) {
    const timestamp = Date.parse(event.created_at)
    if (!Number.isFinite(timestamp) || timestamp >= earliestTimestamp) {
      continue
    }
    earliestTimestamp = timestamp
    earliestValue = event.created_at
  }

  return earliestValue
}

function resolveLatestResolvedAt(events: Event[]) {
  let latestTimestamp = Number.NEGATIVE_INFINITY
  let latestValue: string | null = null

  for (const event of events) {
    if (!event.resolved_at) {
      continue
    }

    const timestamp = Date.parse(event.resolved_at)
    if (!Number.isFinite(timestamp) || timestamp <= latestTimestamp) {
      continue
    }

    latestTimestamp = timestamp
    latestValue = event.resolved_at
  }

  return latestValue
}

function buildSportsGamesCard(
  eventsGroup: Event[],
  options?: { teamSourceEvent?: Event | null },
): SportsGamesCard | null {
  const primaryEvent = eventsGroup.find(event => !isSportsMoreMarketsSlug(event.slug)) ?? eventsGroup[0]
  if (!primaryEvent) {
    return null
  }
  const teamSourceEvent = options?.teamSourceEvent
    ?? eventsGroup.find(event => (event.sports_teams?.length ?? 0) > 0)
    ?? primaryEvent

  const mergedMarkets = mergeMarkets(eventsGroup)
  const eventForDisplay: Event = {
    ...primaryEvent,
    markets: mergedMarkets,
  }

  const teams = toSportsTeams(teamSourceEvent)
  const buttons = buildButtons(eventForDisplay.markets ?? [], teams)
  if (buttons.length === 0) {
    return null
  }

  const detailMarkets = toDetailMarkets(eventForDisplay.markets ?? [], buttons)
  const baseWeek = Number.isFinite(primaryEvent.sports_event_week)
    ? Number(primaryEvent.sports_event_week)
    : null
  const week = resolveWeek(eventsGroup, baseWeek)
  const startTime = resolveStartTime(
    eventsGroup,
    primaryEvent.sports_start_time ?? primaryEvent.start_date ?? null,
  )

  const mergedMarketsCount = sumFiniteValues(eventsGroup.map(event => event.total_markets_count))
  const marketsCount = mergedMarketsCount > 0 ? mergedMarketsCount : mergedMarkets.length

  const volume = resolveMarketsVolume(mergedMarkets)

  return {
    id: primaryEvent.id,
    event: {
      ...eventForDisplay,
      volume,
      total_markets_count: marketsCount,
    },
    slug: primaryEvent.slug,
    eventHref: resolveEventPagePath(primaryEvent),
    title: primaryEvent.title,
    volume,
    marketsCount,
    eventCreatedAt: resolveEarliestCreatedAt(eventsGroup, primaryEvent.created_at),
    eventResolvedAt: resolveLatestResolvedAt(eventsGroup),
    startTime,
    week,
    teams,
    detailMarkets,
    defaultConditionId: buttons[0]?.key ?? null,
    buttons,
  }
}

export function buildSportsGamesCardGroups(events: Event[]): SportsGamesCardGroup[] {
  const groupedEvents = new Map<string, Map<SportsEventMarketViewKey, Event[]>>()

  for (const event of events) {
    const key = resolveEventGroupKey(event)
    const currentGroup = groupedEvents.get(key) ?? new Map<SportsEventMarketViewKey, Event[]>()
    const marketViewKey = resolveMarketViewKeyForEvent(event)
    const currentView = currentGroup.get(marketViewKey) ?? []

    currentView.push(event)
    currentGroup.set(marketViewKey, currentView)
    if (!groupedEvents.has(key)) {
      groupedEvents.set(key, currentGroup)
    }
  }

  return Array.from(groupedEvents.entries())
    .map(([key, marketViewEvents]): SportsGamesCardGroup | null => {
      const allGroupEvents = Array.from(marketViewEvents.values()).flat()
      const teamSourceEvent = allGroupEvents.find(event => (event.sports_teams?.length ?? 0) > 0) ?? null
      const marketViewCards = SPORTS_EVENT_MARKET_VIEW_ORDER
        .map((marketViewKey): SportsGamesCardMarketView | null => {
          const eventsForView = marketViewEvents.get(marketViewKey) ?? []
          if (eventsForView.length === 0) {
            return null
          }

          const card = buildSportsGamesCard(eventsForView, { teamSourceEvent })
          if (!card) {
            return null
          }

          return {
            key: marketViewKey,
            label: SPORTS_EVENT_MARKET_VIEW_LABELS[marketViewKey],
            card,
          }
        })
        .filter((view): view is SportsGamesCardMarketView => Boolean(view))

      if (marketViewCards.length === 0) {
        return null
      }

      const primaryMarketView = marketViewCards.find(view => view.key === 'gameLines') ?? marketViewCards[0]
      if (!primaryMarketView) {
        return null
      }

      const aggregatedMarkets = mergeMarkets(allGroupEvents)
      const aggregatedMarketsCount = sumFiniteValues(allGroupEvents.map(event => event.total_markets_count))
      const aggregatedVolume = resolveMarketsVolume(aggregatedMarkets)
      const primaryCard = {
        ...primaryMarketView.card,
        volume: aggregatedVolume,
        marketsCount: aggregatedMarketsCount > 0 ? aggregatedMarketsCount : primaryMarketView.card.marketsCount,
        event: {
          ...primaryMarketView.card.event,
          volume: aggregatedVolume,
          total_markets_count: aggregatedMarketsCount > 0
            ? aggregatedMarketsCount
            : primaryMarketView.card.event.total_markets_count,
        },
      }

      return {
        key,
        primaryCard,
        marketViewCards,
      }
    })
    .filter((group): group is SportsGamesCardGroup => Boolean(group))
    .sort((left, right) => toSortableTimestamp(left.primaryCard.startTime) - toSortableTimestamp(right.primaryCard.startTime))
}

export function buildSportsGamesCards(events: Event[]) {
  return buildSportsGamesCardGroups(events).map(group => group.primaryCard)
}

export function mergeSportsGamesCardMarkets(cards: SportsGamesCard[]) {
  const byConditionId = new Map<string, Market>()

  for (const card of cards) {
    for (const market of card.detailMarkets) {
      if (!market.condition_id || byConditionId.has(market.condition_id)) {
        continue
      }

      byConditionId.set(market.condition_id, market)
    }
  }

  return Array.from(byConditionId.values())
}

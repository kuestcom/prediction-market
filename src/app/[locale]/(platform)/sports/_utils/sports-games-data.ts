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
  marketType: 'moneyline' | 'spread' | 'total' | 'btts' | 'binary'
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

export function hasSportsGamesCardPrimaryMarketTrio(card: Pick<SportsGamesCard, 'buttons'>) {
  const marketTypes = new Set(card.buttons.map(button => button.marketType))
  return marketTypes.has('moneyline') && marketTypes.has('spread') && marketTypes.has('total')
}

const COLLAPSED_CARD_MARKET_PRIORITY: SportsGamesButton['marketType'][] = [
  'moneyline',
  'binary',
  'btts',
  'spread',
  'total',
]

export function resolveSportsGamesCardCollapsedMarketType(
  card: Pick<SportsGamesCard, 'buttons'>,
): SportsGamesButton['marketType'] | null {
  const marketTypes = new Set(card.buttons.map(button => button.marketType))
  return COLLAPSED_CARD_MARKET_PRIORITY.find(marketType => marketTypes.has(marketType)) ?? null
}
export function resolveSportsGamesCardVisibleMarketTypes(
  card: Pick<SportsGamesCard, 'buttons'>,
  showSpreadsAndTotals: boolean,
): SportsGamesButton['marketType'][] {
  if (showSpreadsAndTotals && hasSportsGamesCardPrimaryMarketTrio(card)) {
    return ['moneyline', 'spread', 'total']
  }

  const collapsedMarketType = resolveSportsGamesCardCollapsedMarketType(card)
  return collapsedMarketType ? [collapsedMarketType] : []
}

export function resolveSportsGamesHeaderMarketTypes(
  cards: Array<Pick<SportsGamesCard, 'buttons' | 'event'>>,
  showSpreadsAndTotals: boolean,
): SportsGamesButton['marketType'][] {
  if (!showSpreadsAndTotals) {
    return []
  }

  const candidateColumns = cards
    .filter(card => card.event.sports_ended !== true)
    .map(card => resolveSportsGamesCardVisibleMarketTypes(card, showSpreadsAndTotals))
    .filter(columns => columns.length > 0)

  const [firstColumns, ...remainingColumns] = candidateColumns
  if (!firstColumns) {
    return []
  }

  return remainingColumns.every(columns =>
    columns.length === firstColumns.length
    && columns.every((column, index) => column === firstColumns[index]))
    ? firstColumns
    : []
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

const AUXILIARY_BUTTON_TONE_ORDER: Record<SportsGamesButton['tone'], number> = {
  team1: 0,
  draw: 1,
  team2: 2,
  over: 3,
  under: 4,
  neutral: 5,
}

const SPORTS_MARKET_TYPE_PREFIXES = new Set([
  'americanfootball',
  'baseball',
  'basketball',
  'boxing',
  'cricket',
  'cs2',
  'dota2',
  'football',
  'golf',
  'hockey',
  'lol',
  'mma',
  'nba',
  'nfl',
  'nhl',
  'rugby',
  'soccer',
  'tennis',
  'ufc',
  'valorant',
])

function normalizeText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

function toTitleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) {
        return word.toUpperCase()
      }

      return `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`
    })
    .join(' ')
}

export function resolveSportsMarketTypeLabel(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const tokens = normalized.split('_').filter(Boolean)
  if (tokens.length === 0) {
    return null
  }

  const normalizedTokens = SPORTS_MARKET_TYPE_PREFIXES.has(tokens[0] ?? '')
    ? tokens.slice(1)
    : tokens
  if (normalizedTokens.length === 0) {
    return null
  }

  return toTitleCaseWords(normalizedTokens.join(' '))
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

function marketTitleTexts(market: Market) {
  return [
    market.sports_group_item_title,
    market.short_title,
    market.title,
  ]
    .map(value => value?.trim() ?? '')
    .filter(Boolean)
}

function isExplicitMoneylineMarket(market: Market) {
  const normalizedType = normalizeText(market.sports_market_type)
  if (
    normalizedType.includes('moneyline')
    || normalizedType.includes('match winner')
    || normalizedType === '1x2'
  ) {
    return true
  }

  if (normalizedType) {
    return false
  }

  const marketText = ` ${normalizeText(`${market.short_title ?? ''} ${market.title ?? ''}`)} `
  return marketText.includes(' moneyline ')
    || marketText.includes(' match winner ')
    || marketText.includes(' 1x2 ')
}

function isChildMoneylineMarket(market: Market) {
  return normalizeText(market.sports_market_type) === 'child moneyline'
}

function hasExplicitNonMoneylineMarketType(market: Market) {
  const normalizedType = normalizeText(market.sports_market_type)
  return Boolean(normalizedType) && !isExplicitMoneylineMarket(market)
}

function isDrawMarket(market: Market) {
  return normalizeText(marketDisplayText(market)).includes('draw')
}

function isYesNoOutcomeText(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return normalized === 'yes' || normalized === 'no'
}

function isBinaryYesNoMarket(market: Market) {
  if ((market.outcomes?.length ?? 0) !== 2) {
    return false
  }

  const outcomeTexts = market.outcomes.map(outcome => outcome.outcome_text)
  return outcomeTexts.every(isYesNoOutcomeText)
}

function hasMarketSlugSuffix(market: Market, suffix: string) {
  return market.slug?.trim().toLowerCase().endsWith(suffix) ?? false
}

function isStandaloneDrawMarket(market: Market) {
  return hasMarketSlugSuffix(market, '-draw')
    || marketTitleTexts(market).some(value => normalizeText(value) === 'draw')
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

function doesTextExactlyMatchTeam(value: string | null | undefined, team: SportsGamesTeam | null) {
  if (!value || !team) {
    return false
  }

  const normalizedValue = normalizeText(value)
  if (!normalizedValue) {
    return false
  }

  const normalizedName = normalizeText(team.name)
  if (normalizedName && normalizedValue === normalizedName) {
    return true
  }

  const normalizedAbbreviation = normalizeText(team.abbreviation)
  return Boolean(normalizedAbbreviation && normalizedValue === normalizedAbbreviation)
}

function doesMarketExactlyMatchTeam(market: Market, team: SportsGamesTeam | null) {
  return marketTitleTexts(market).some(value => doesTextExactlyMatchTeam(value, team))
}

function isSeparatedMoneylineCandidate(market: Market, teams: SportsGamesTeam[]) {
  if (hasExplicitNonMoneylineMarketType(market)) {
    return false
  }

  if ((market.outcomes?.length ?? 0) < 2) {
    return false
  }

  if (isStandaloneDrawMarket(market)) {
    return true
  }

  return teams.some(team => doesMarketExactlyMatchTeam(market, team))
}

function dedupeMarketsByConditionId(markets: Market[]) {
  const seenConditionIds = new Set<string>()
  return markets.filter((market) => {
    if (!market.condition_id || seenConditionIds.has(market.condition_id)) {
      return false
    }

    seenConditionIds.add(market.condition_id)
    return true
  })
}

function resolvePreferredYesOutcomeIndex(market: Market | null | undefined) {
  if (!market) {
    return 0
  }

  return market.outcomes.find(outcome => /^yes$/i.test(outcome.outcome_text?.trim() ?? ''))?.outcome_index
    ?? market.outcomes.find(outcome => outcome.outcome_index === 0)?.outcome_index
    ?? market.outcomes[0]?.outcome_index
    ?? 0
}

function hasUsedButtonForConditionId(usedButtonKeys: Set<string>, conditionId: string | null | undefined) {
  if (!conditionId) {
    return false
  }

  for (const buttonKey of usedButtonKeys) {
    if (buttonKey.startsWith(`${conditionId}:`)) {
      return true
    }
  }

  return false
}

function buildFallbackAbbreviation(teamName: string) {
  return teamName
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
}

function toSportsTeams(event: Event) {
  const logoUrls = event.sports_team_logo_urls ?? []
  const rawTeams = (event.sports_teams ?? []) as SportsTeam[]
  const canUseIndexedLogoFallback = (
    rawTeams.length > 0
    && logoUrls.length >= rawTeams.length
    && rawTeams.every(team => Boolean(team.name?.trim()))
  )
  const teams = rawTeams
    .map((team, index): SportsGamesTeam | null => {
      const name = team.name?.trim() ?? ''
      if (!name) {
        return null
      }

      const abbreviation = team.abbreviation?.trim() || buildFallbackAbbreviation(name)
      const logoUrl = team.logo_url?.trim() || (canUseIndexedLogoFallback ? logoUrls[index] : null) || null

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

  const marketText = ` ${normalizeText(marketDisplayText(market))} `
  if (marketText.includes(' both teams to score ') || marketText.includes(' btts ')) {
    return 'btts' as const
  }
  if (isStandaloneDrawMarket(market) && isExplicitMoneylineMarket(market)) {
    return 'moneyline' as const
  }
  if (isBinaryYesNoMarket(market)) {
    return 'binary' as const
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

  if (/\bover\b/.test(marketText) || /\bunder\b/.test(marketText)) {
    return 'total' as const
  }
  if (/[+-]\s*\d/.test(marketDisplayText(market))) {
    return 'spread' as const
  }

  return null
}

function sortAuxiliaryButtons(buttons: SportsGamesButton[]) {
  return [...buttons].sort((left, right) => {
    const toneComparison = (AUXILIARY_BUTTON_TONE_ORDER[left.tone] ?? 99) - (AUXILIARY_BUTTON_TONE_ORDER[right.tone] ?? 99)
    if (toneComparison !== 0) {
      return toneComparison
    }

    return left.label.localeCompare(right.label)
  })
}

export function resolveSportsAuxiliaryMarketGroupKey(market: Market) {
  const normalizedType = normalizeText(market.sports_market_type)
  if (!normalizedType) {
    return market.condition_id
  }

  return `${market.event_id}:${normalizedType}`
}

export function resolveSportsAuxiliaryMarketTitle(markets: Market[]) {
  const primaryMarket = markets[0]
  if (!primaryMarket) {
    return 'Market'
  }

  return resolveSportsMarketTypeLabel(primaryMarket.sports_market_type)
    ?? primaryMarket.sports_group_item_title?.trim()
    ?? primaryMarket.short_title?.trim()
    ?? primaryMarket.title
}

function resolveAuxiliaryMarketLabel(market: Market) {
  return market.sports_group_item_title?.trim()
    || market.short_title?.trim()
    || market.title?.trim()
    || 'MARKET'
}

function resolveAuxiliaryMarketTone(
  label: string,
  team1: SportsGamesTeam | null,
  team2: SportsGamesTeam | null,
): SportsGamesButton['tone'] {
  const normalizedLabel = normalizeText(label)
  if (normalizedLabel.includes('draw')) {
    return 'draw'
  }

  if (doesTextMatchTeam(label, team1)) {
    return 'team1'
  }

  if (doesTextMatchTeam(label, team2)) {
    return 'team2'
  }

  return 'neutral'
}

function resolveAuxiliaryButtonLabel(
  market: Market,
  team1: SportsGamesTeam | null,
  team2: SportsGamesTeam | null,
) {
  const rawLabel = resolveAuxiliaryMarketLabel(market)
  const tone = resolveAuxiliaryMarketTone(rawLabel, team1, team2)

  if (tone === 'team1') {
    return {
      label: toTeamButtonLabel(team1, rawLabel.toUpperCase()),
      color: team1?.color ?? null,
      tone,
    }
  }

  if (tone === 'team2') {
    return {
      label: toTeamButtonLabel(team2, rawLabel.toUpperCase()),
      color: team2?.color ?? null,
      tone,
    }
  }

  if (tone === 'draw') {
    return {
      label: 'DRAW',
      color: null,
      tone,
    }
  }

  return {
    label: rawLabel.trim().toUpperCase() || 'MARKET',
    color: null,
    tone,
  }
}

function buildCompositeAuxiliaryButtons(
  markets: Market[],
  teams: SportsGamesTeam[],
  usedButtonKeys: Set<string>,
) {
  const { team1, team2 } = resolvePrimaryTeams(teams)
  const groupedMarkets = new Map<string, Market[]>()

  markets.forEach((market) => {
    const key = resolveSportsAuxiliaryMarketGroupKey(market)
    const existing = groupedMarkets.get(key)
    if (existing) {
      existing.push(market)
      return
    }

    groupedMarkets.set(key, [market])
  })

  const groupedConditionIds = new Set<string>()
  const buttons: SportsGamesButton[] = []

  Array.from(groupedMarkets.values())
    .filter(group => group.length > 1)
    .sort((left, right) => {
      const leftTimestamp = toSortableTimestamp(left[0]?.created_at ?? null)
      const rightTimestamp = toSortableTimestamp(right[0]?.created_at ?? null)
      if (leftTimestamp !== rightTimestamp) {
        return leftTimestamp - rightTimestamp
      }

      return resolveSportsAuxiliaryMarketTitle(left).localeCompare(resolveSportsAuxiliaryMarketTitle(right))
    })
    .forEach((group) => {
      const groupedButtons: SportsGamesButton[] = []

      group.forEach((market) => {
        groupedConditionIds.add(market.condition_id)
        const { label, color, tone } = resolveAuxiliaryButtonLabel(market, team1, team2)

        appendButton(groupedButtons, usedButtonKeys, market, resolvePreferredYesOutcomeIndex(market), {
          label,
          color,
          marketType: 'binary',
          tone,
        }, {
          fallbackIsNoOutcome: false,
        })
      })

      buttons.push(...sortAuxiliaryButtons(groupedButtons))
    })

  return {
    buttons,
    groupedConditionIds,
  }
}

function buildStandaloneAuxiliaryButtons(
  markets: Market[],
  teams: SportsGamesTeam[],
  usedButtonKeys: Set<string>,
) {
  const { team1, team2 } = resolvePrimaryTeams(teams)
  const buttons: SportsGamesButton[] = []

  const sortedMarkets = [...markets].sort((left, right) => {
    const thresholdComparison = toSortableThreshold(left.sports_group_item_threshold)
      - toSortableThreshold(right.sports_group_item_threshold)
    if (thresholdComparison !== 0) {
      return thresholdComparison
    }

    const timestampComparison = toSortableTimestamp(left.created_at) - toSortableTimestamp(right.created_at)
    if (timestampComparison !== 0) {
      return timestampComparison
    }

    return resolveSportsAuxiliaryMarketTitle([left]).localeCompare(resolveSportsAuxiliaryMarketTitle([right]))
  })

  for (const market of sortedMarkets) {
    if (isBinaryYesNoMarket(market)) {
      const yesOutcome = market.outcomes.find(outcome => /^yes$/i.test(outcome.outcome_text?.trim() ?? ''))
        ?? market.outcomes.find(outcome => outcome.outcome_index === 0)
        ?? market.outcomes[0]
        ?? null
      const noOutcome = market.outcomes.find(outcome => /^no$/i.test(outcome.outcome_text?.trim() ?? ''))
        ?? market.outcomes.find(outcome => outcome.outcome_index !== yesOutcome?.outcome_index)
        ?? null

      appendButton(buttons, usedButtonKeys, market, yesOutcome?.outcome_index ?? 0, {
        label: 'YES',
        color: null,
        marketType: 'binary',
        tone: 'over',
      })
      appendButton(buttons, usedButtonKeys, market, noOutcome?.outcome_index ?? 1, {
        label: 'NO',
        color: null,
        marketType: 'binary',
        tone: 'under',
      })
      continue
    }

    const orderedOutcomes = [...market.outcomes].sort((left, right) => left.outcome_index - right.outcome_index)
    orderedOutcomes.forEach((outcome, index) => {
      const outcomeText = outcome.outcome_text?.trim() ?? ''
      const normalizedOutcomeText = normalizeText(outcomeText)
      const matchedTeam = teams.find(team => doesTextMatchTeam(outcomeText, team)) ?? null
      const fallbackTeam = index === 0 ? team1 : index === orderedOutcomes.length - 1 ? team2 : null
      const resolvedTeam = matchedTeam ?? fallbackTeam
      const isDrawOutcome = normalizedOutcomeText.includes('draw')
      const label = isDrawOutcome
        ? 'DRAW'
        : resolvedTeam
          ? toTeamButtonLabel(resolvedTeam, outcomeText || 'TEAM')
          : outcomeText.toUpperCase() || 'MARKET'

      appendButton(buttons, usedButtonKeys, market, outcome.outcome_index, {
        label,
        color: resolvedTeam?.color ?? null,
        marketType: 'binary',
        tone: isDrawOutcome
          ? 'draw'
          : resolvedTeam === team1
            ? 'team1'
            : resolvedTeam === team2
              ? 'team2'
              : 'neutral',
      }, {
        fallbackIsNoOutcome: false,
      })
    })
  }

  return buttons
}

function buildAuxiliaryButtons(
  marketsByType: ReturnType<typeof groupMarketsByType>,
  teams: SportsGamesTeam[],
  usedButtonKeys: Set<string>,
) {
  const auxiliaryCandidates = dedupeMarketsByConditionId([
    ...marketsByType.binary,
    ...marketsByType.untyped.filter(market => !isExplicitMoneylineMarket(market)),
  ]).filter(market => !hasUsedButtonForConditionId(usedButtonKeys, market.condition_id))

  if (auxiliaryCandidates.length === 0) {
    return []
  }

  const { buttons: compositeButtons, groupedConditionIds } = buildCompositeAuxiliaryButtons(
    auxiliaryCandidates,
    teams,
    usedButtonKeys,
  )
  const standaloneMarkets = auxiliaryCandidates.filter(market => !groupedConditionIds.has(market.condition_id))
  const standaloneButtons = buildStandaloneAuxiliaryButtons(standaloneMarkets, teams, usedButtonKeys)

  return [...compositeButtons, ...standaloneButtons]
}

function groupMarketsByType(markets: Market[]) {
  const grouped = {
    moneyline: [] as Market[],
    spread: [] as Market[],
    total: [] as Market[],
    btts: [] as Market[],
    binary: [] as Market[],
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
    if (marketType === 'binary') {
      grouped.binary.push(market)
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
  options?: {
    fallbackIsNoOutcome?: boolean
  },
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

  const isNoOutcome = options?.fallbackIsNoOutcome ?? outcomeIndex === 1
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
  const primaryMoneylineMarkets = marketsByType.moneyline.filter(market => !isChildMoneylineMarket(market))
  const preferredMoneylineMarkets = primaryMoneylineMarkets.length > 0
    ? primaryMoneylineMarkets
    : marketsByType.moneyline
  const untypedMoneylineCandidates = marketsByType.untyped.filter(market =>
    !isBinaryYesNoMarket(market) && isExplicitMoneylineMarket(market),
  )
  const separatedMoneylineCandidates = dedupeMarketsByConditionId([
    ...marketsByType.untyped,
    ...marketsByType.binary,
  ].filter(market => isSeparatedMoneylineCandidate(market, teams)))
  const candidates = dedupeMarketsByConditionId(
    preferredMoneylineMarkets.length > 0
      ? (
          preferredMoneylineMarkets.length >= 2
            ? preferredMoneylineMarkets
            : [...preferredMoneylineMarkets, ...untypedMoneylineCandidates, ...separatedMoneylineCandidates]
        )
      : [...untypedMoneylineCandidates, ...separatedMoneylineCandidates],
  )

  if (candidates.length === 0) {
    return []
  }

  const compositeMarket = candidates.find((market) => {
    if (isBinaryYesNoMarket(market) || (market.outcomes?.length ?? 0) < 2) {
      return false
    }

    const hasTeam1Outcome = team1
      ? market.outcomes.some(outcome => doesTextMatchTeam(outcome.outcome_text, team1))
      : false
    const hasTeam2Outcome = team2
      ? market.outcomes.some(outcome => doesTextMatchTeam(outcome.outcome_text, team2))
      : false

    return hasTeam1Outcome && hasTeam2Outcome
  }) ?? null

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
      const separatedDrawMarket = candidates.find(market =>
        market.condition_id !== compositeMarket.condition_id
        && isStandaloneDrawMarket(market),
      )
      if (separatedDrawMarket && !buttons.some(button => button.tone === 'draw')) {
        appendButton(buttons, usedButtonKeys, separatedDrawMarket, resolvePreferredYesOutcomeIndex(separatedDrawMarket), {
          label: 'DRAW',
          color: null,
          marketType: 'moneyline',
          tone: 'draw',
        }, {
          fallbackIsNoOutcome: false,
        })
      }

      return buttons
    }
  }

  const nonDrawMarkets = candidates.filter(market => !isStandaloneDrawMarket(market))
  const team1Market = team1 ? nonDrawMarkets.find(market => doesMarketMatchTeam(market, team1)) : undefined
  const team2Market = team2
    ? nonDrawMarkets.find(market => market !== team1Market && doesMarketMatchTeam(market, team2))
    : undefined
  const drawMarket = candidates.find(market => isStandaloneDrawMarket(market))

  const buttons: SportsGamesButton[] = []

  appendButton(buttons, usedButtonKeys, team1Market, resolvePreferredYesOutcomeIndex(team1Market), {
    label: toTeamButtonLabel(team1, 'TEAM 1'),
    color: team1?.color ?? null,
    marketType: 'moneyline',
    tone: 'team1',
  }, {
    fallbackIsNoOutcome: false,
  })
  appendButton(buttons, usedButtonKeys, drawMarket, resolvePreferredYesOutcomeIndex(drawMarket), {
    label: 'DRAW',
    color: null,
    marketType: 'moneyline',
    tone: 'draw',
  }, {
    fallbackIsNoOutcome: false,
  })
  appendButton(buttons, usedButtonKeys, team2Market, resolvePreferredYesOutcomeIndex(team2Market), {
    label: toTeamButtonLabel(team2, 'TEAM 2'),
    color: team2?.color ?? null,
    marketType: 'moneyline',
    tone: 'team2',
  }, {
    fallbackIsNoOutcome: false,
  })

  for (const market of candidates) {
    if (buttons.length >= 3) {
      break
    }

    if (hasUsedButtonForConditionId(usedButtonKeys, market.condition_id)) {
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

    const fallbackOutcomeIndex = isBinaryYesNoMarket(market)
      ? resolvePreferredYesOutcomeIndex(market)
      : 0

    appendButton(buttons, usedButtonKeys, market, fallbackOutcomeIndex, {
      label: fallbackLabel,
      color: matchedTeam?.color ?? null,
      marketType: 'moneyline',
      tone,
    }, {
      fallbackIsNoOutcome: !isBinaryYesNoMarket(market) && fallbackOutcomeIndex === 1,
    })
  }

  return buttons
}

function buildChildMoneylineButtons(
  marketsByType: ReturnType<typeof groupMarketsByType>,
  teams: SportsGamesTeam[],
  usedButtonKeys: Set<string>,
) {
  const childMoneylineMarkets = dedupeMarketsByConditionId(
    marketsByType.moneyline.filter(isChildMoneylineMarket),
  )

  if (childMoneylineMarkets.length === 0) {
    return []
  }

  return buildStandaloneAuxiliaryButtons(childMoneylineMarkets, teams, usedButtonKeys)
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

function toSortableThreshold(value: string | null | undefined) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : Number.POSITIVE_INFINITY
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
  const childMoneylineButtons = buildChildMoneylineButtons(
    marketsByType,
    teams,
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
  const auxiliaryButtons = buildAuxiliaryButtons(
    marketsByType,
    teams,
    usedButtonKeys,
  )

  return [
    ...moneylineButtons,
    ...spreadButtons,
    ...totalButtons,
    ...bttsButtons,
    ...childMoneylineButtons,
    ...auxiliaryButtons,
  ]
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
  if (typeof event.sports_parent_event_id === 'number' && Number.isFinite(event.sports_parent_event_id)) {
    return String(event.sports_parent_event_id)
  }

  const sportsEventId = event.sports_event_id?.trim()
  if (sportsEventId) {
    return sportsEventId
  }

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

function resolveMarketStartTime(markets: Market[]) {
  let earliestTimestamp = Number.POSITIVE_INFINITY
  let earliestValue: string | null = null

  for (const market of markets) {
    const value = market.sports_game_start_time ?? market.sports_start_time ?? null
    if (!value) {
      continue
    }

    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp) || timestamp >= earliestTimestamp) {
      continue
    }

    earliestTimestamp = timestamp
    earliestValue = value
  }

  return earliestValue
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
  const primaryEvent = eventsGroup.find(event => event.sports_parent_event_id == null)
    ?? eventsGroup.find(event => !isSportsMoreMarketsSlug(event.slug))
    ?? eventsGroup[0]
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
    resolveMarketStartTime(mergedMarkets) ?? primaryEvent.sports_start_time ?? primaryEvent.start_date ?? null,
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

import type {
  EsportsLayoutTabKey,
  EventSectionKey,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
import type { SportsGamesButton, SportsGamesCard, SportsGamesCardMarketView } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { OddsFormat } from '@/lib/odds-format'
import type { SportsVertical } from '@/lib/sports-vertical'
import type { UserPosition } from '@/types'
import {
  FULL_COMPETITOR_NAME_HERO_LABEL_SPORT_SLUGS,
  SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { resolveOutcomeSelectionPriceCents } from '@/lib/market-pricing'
import { ODDS_FORMAT_OPTIONS } from '@/lib/odds-format'

function resolveInitialOddsFormat(): OddsFormat {
  if (typeof window === 'undefined') {
    return 'price'
  }

  const storedOddsFormat = window.localStorage.getItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY)
  const matchedOption = ODDS_FORMAT_OPTIONS.find(option => option.value === storedOddsFormat)
  return matchedOption?.value ?? 'price'
}

export function subscribeToOddsFormatStorage(listener: () => void) {
  if (typeof window === 'undefined') {
    return function unsubscribeFromOddsFormatStorage() {}
  }

  function handleStorage(event: StorageEvent) {
    if (event.key && event.key !== SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY) {
      return
    }

    listener()
  }

  window.addEventListener('storage', handleStorage)
  return function unsubscribeFromOddsFormatStorage() {
    window.removeEventListener('storage', handleStorage)
  }
}

export function getStoredOddsFormatClientSnapshot(): OddsFormat {
  return resolveInitialOddsFormat()
}

export function getStoredOddsFormatServerSnapshot(): OddsFormat {
  return 'price'
}

export function areRecordValuesEqual<T extends string | null | undefined>(
  left: Record<string, T>,
  right: Record<string, T>,
) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every(key => left[key] === right[key])
}

export function parseRequestedOutcomeIndex(value: string | null | undefined) {
  const rawValue = value?.trim() ?? ''
  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeSportsMarketType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function resolveMoneylineButtonGridClass(buttonCount: number) {
  if (buttonCount <= 1) {
    return 'grid-cols-1'
  }

  if (buttonCount === 2) {
    return 'grid-cols-2'
  }

  return 'grid-cols-3'
}

function parseEsportsSegmentDescriptor(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  if (!market) {
    return null
  }

  const segmentMatch = [
    market.sports_group_item_title,
    market.short_title,
    market.title,
    market.slug,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .match(/\b(map|game)\s*(\d+)\b/i)

  if (!segmentMatch?.[1] || !segmentMatch[2]) {
    return null
  }

  const parsed = Number.parseInt(segmentMatch[2], 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return {
    kind: segmentMatch[1].toLowerCase() === 'map' ? 'map' : 'game',
    number: parsed,
  } as const
}

export function parseEsportsSegmentNumber(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  return parseEsportsSegmentDescriptor(market)?.number ?? null
}

export function isSegmentedEsportsEventCard(card: SportsGamesCard, vertical: SportsVertical) {
  return vertical === 'esports'
    && card.detailMarkets.some(market => parseEsportsSegmentDescriptor(market) != null)
}

export function resolveEsportsSegmentLabels(card: SportsGamesCard) {
  const segmentKinds = new Set(
    card.detailMarkets
      .map(market => parseEsportsSegmentDescriptor(market)?.kind ?? null)
      .filter((kind): kind is 'map' | 'game' => kind === 'map' || kind === 'game'),
  )

  if (segmentKinds.size === 1) {
    const [kind] = Array.from(segmentKinds)
    return kind === 'map'
      ? { singular: 'Map', plural: 'Maps' }
      : { singular: 'Game', plural: 'Games' }
  }

  return { singular: 'Game', plural: 'Games' }
}

export function isSegmentedEsportsChildMoneylineMarket(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  return normalizeSportsMarketType(market?.sports_market_type) === 'child_moneyline'
}

function isSegmentedEsportsBinaryMarket(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  return parseEsportsSegmentNumber(market) != null && !isSegmentedEsportsChildMoneylineMarket(market)
}

function isSegmentedEsportsPrimaryMoneylineMarket(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  if (!market || isSegmentedEsportsChildMoneylineMarket(market)) {
    return false
  }

  const normalizedType = normalizeSportsMarketType(market.sports_market_type)
  if (normalizedType === 'moneyline') {
    return true
  }

  const marketText = [
    market.sports_group_item_title,
    market.short_title,
    market.title,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()

  return marketText.includes('match winner') || marketText.includes('moneyline')
}

export function resolveEsportsSegmentTabKey(mapNumber: number): EsportsLayoutTabKey {
  return `segment-${mapNumber}`
}

export function parseEsportsSegmentTabNumber(tabKey: EsportsLayoutTabKey) {
  if (tabKey === 'series') {
    return null
  }

  const parsed = Number.parseInt(tabKey.slice(8), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveEsportsSegmentPanelTitle(markets: SportsGamesCard['detailMarkets']) {
  const primaryMarket = markets[0]
  if (!primaryMarket) {
    return 'Market'
  }

  return primaryMarket.short_title?.trim()
    || primaryMarket.sports_group_item_title?.trim()
    || primaryMarket.title
}

export function resolveEsportsSegmentPanelSortOrder(markets: SportsGamesCard['detailMarkets']) {
  const normalizedType = normalizeSportsMarketType(markets[0]?.sports_market_type)
  if (normalizedType === 'child_moneyline') {
    return 0
  }
  if (normalizedType === 'spread' || normalizedType === 'map_handicap' || normalizedType.includes('handicap')) {
    return 1
  }
  if (normalizedType === 'total' || normalizedType === 'totals' || normalizedType.includes('total')) {
    return 2
  }
  if (normalizedType.endsWith('odd_even_total_kills')) {
    return 3
  }
  if (normalizedType.endsWith('odd_even_total_rounds')) {
    return 4
  }
  return 99
}

export function resolvePositionShares(position: UserPosition) {
  const totalShares = typeof position.total_shares === 'number' ? position.total_shares : Number(position.size ?? 0)
  return Number.isFinite(totalShares) ? totalShares : 0
}

export function resolveOutcomeIndexFromPosition(position: UserPosition) {
  if (position.outcome_index === OUTCOME_INDEX.YES || position.outcome_index === OUTCOME_INDEX.NO) {
    return position.outcome_index
  }

  const normalizedOutcome = position.outcome_text?.trim().toLowerCase()
  if (normalizedOutcome === 'no') {
    return OUTCOME_INDEX.NO
  }
  if (normalizedOutcome === 'yes') {
    return OUTCOME_INDEX.YES
  }
  return null
}

export function resolveIndexSetFromOutcomeIndex(outcomeIndex: number | null | undefined) {
  if (outcomeIndex === OUTCOME_INDEX.YES) {
    return 1
  }
  if (outcomeIndex === OUTCOME_INDEX.NO) {
    return 2
  }
  return null
}

export function resolveTeamShortLabel(team: SportsGamesCard['teams'][number] | null | undefined) {
  const abbreviation = team?.abbreviation?.trim()
  if (abbreviation) {
    return abbreviation.toUpperCase()
  }

  const name = team?.name?.trim()
  if (!name) {
    return '—'
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)

  return initials || name.slice(0, 3).toUpperCase()
}

function shouldUseFullCompetitorHeroLabels(sportSlug: string | null | undefined) {
  return FULL_COMPETITOR_NAME_HERO_LABEL_SPORT_SLUGS.has(
    normalizeComparableToken(sportSlug),
  )
}

export function shouldUseFullScoreboardHeroLabels({
  sportSlug,
  vertical,
}: {
  sportSlug: string | null | undefined
  vertical: SportsVertical
}) {
  return vertical === 'esports' || shouldUseFullCompetitorHeroLabels(sportSlug)
}

export function parseSportsScore(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\D+(\d+)/)
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

export function resolveRelatedTeamOdds(card: SportsGamesCard) {
  const moneylineButtons = card.buttons.filter(button => button.marketType === 'moneyline')
  const team1Button = moneylineButtons.find(button => button.tone === 'team1') ?? moneylineButtons[0] ?? null
  const team2Button = moneylineButtons.find(button => button.tone === 'team2')
    ?? moneylineButtons.find(button => button.key !== team1Button?.key)
    ?? null

  return {
    team1Cents: team1Button?.cents ?? null,
    team2Cents: team2Button?.cents ?? null,
  }
}

export function formatRelatedOddsLabel(cents: number | null) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) {
    return '—'
  }
  return `${cents}¢`
}

function normalizeComparableToken(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
    ?? ''
}

function tokenizeComparableText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    ?? []
}

function doesTextMatchSportsTeam(
  value: string | null | undefined,
  team: SportsGamesCard['teams'][number] | null | undefined,
) {
  if (!value || !team) {
    return false
  }

  const normalizedValue = normalizeComparableToken(value)
  if (!normalizedValue) {
    return false
  }

  const normalizedTeamName = normalizeComparableToken(team.name)
  if (normalizedTeamName && normalizedValue.includes(normalizedTeamName)) {
    return true
  }

  const normalizedTeamAbbreviation = normalizeComparableToken(team.abbreviation)
  if (!normalizedTeamAbbreviation) {
    return false
  }

  return new Set(tokenizeComparableText(value)).has(normalizedTeamAbbreviation)
}

function resolveSegmentedEsportsButtonMarketType(
  market: SportsGamesCard['detailMarkets'][number],
): SportsGamesButton['marketType'] {
  const normalizedType = normalizeSportsMarketType(market.sports_market_type)

  if (isSegmentedEsportsChildMoneylineMarket(market) || isSegmentedEsportsPrimaryMoneylineMarket(market)) {
    return 'moneyline'
  }

  if (
    normalizedType === 'spread'
    || normalizedType === 'map_handicap'
    || normalizedType.includes('handicap')
  ) {
    return 'spread'
  }

  if (
    normalizedType === 'total'
    || normalizedType === 'totals'
    || normalizedType.includes('total')
  ) {
    return 'total'
  }

  if (
    normalizedType === 'btts'
    || normalizedType.includes('both_teams_to_score')
    || normalizedType.includes('both teams to score')
  ) {
    return 'btts'
  }

  return 'binary'
}

function buildSegmentedEsportsButtonsFromOutcomes(
  card: SportsGamesCard,
  market: SportsGamesCard['detailMarkets'][number],
) {
  const team1 = card.teams[0] ?? null
  const team2 = card.teams[1] ?? null
  const marketType = resolveSegmentedEsportsButtonMarketType(market)

  return [...market.outcomes]
    .sort((left, right) => left.outcome_index - right.outcome_index)
    .map((outcome) => {
      const outcomeText = outcome.outcome_text?.trim() ?? ''
      const normalizedOutcomeText = normalizeComparableToken(outcomeText)
      const matchedTeam = [team1, team2].find(team => doesTextMatchSportsTeam(outcomeText, team)) ?? null

      let label = outcomeText.toUpperCase() || 'MARKET'
      let color: string | null = null
      let tone: SportsGamesButton['tone'] = 'neutral'

      if (matchedTeam === team1) {
        label = resolveTeamShortLabel(team1)
        color = team1?.color ?? null
        tone = 'team1'
      }
      else if (matchedTeam === team2) {
        label = resolveTeamShortLabel(team2)
        color = team2?.color ?? null
        tone = 'team2'
      }
      else if (normalizedOutcomeText.includes('draw')) {
        label = 'DRAW'
        tone = 'draw'
      }
      else if (normalizedOutcomeText === 'yes') {
        label = 'YES'
        tone = 'over'
      }
      else if (normalizedOutcomeText === 'no') {
        label = 'NO'
        tone = 'under'
      }
      else if (normalizedOutcomeText === 'over') {
        label = 'OVER'
        tone = 'over'
      }
      else if (normalizedOutcomeText === 'under') {
        label = 'UNDER'
        tone = 'under'
      }

      const fallbackIsNoOutcome = normalizedOutcomeText === 'no'

      return {
        key: `${market.condition_id}:${outcome.outcome_index}`,
        conditionId: market.condition_id,
        outcomeIndex: outcome.outcome_index,
        fallbackIsNoOutcome,
        label,
        cents: resolveOutcomeSelectionPriceCents(market, outcome, {
          side: ORDER_SIDE.BUY,
          fallbackIsNoOutcome,
        }) ?? 50,
        color,
        marketType,
        tone,
      } satisfies SportsGamesButton
    })
}

function shouldNormalizeSegmentedEsportsMarketButtons(
  market: SportsGamesCard['detailMarkets'][number],
  currentButtons: SportsGamesButton[],
) {
  if (parseEsportsSegmentNumber(market) == null || market.outcomes.length <= 1) {
    return false
  }

  if (currentButtons.length !== market.outcomes.length) {
    return true
  }

  const expectedMarketType = resolveSegmentedEsportsButtonMarketType(market)
  if (currentButtons.some(button => button.marketType !== expectedMarketType)) {
    return true
  }

  const currentOutcomeIndexes = new Set(currentButtons.map(button => button.outcomeIndex))
  return market.outcomes.some(outcome => !currentOutcomeIndexes.has(outcome.outcome_index))
}

export function resolveNormalizedSegmentedEsportsCard(
  card: SportsGamesCard,
  vertical: SportsVertical,
) {
  if (!isSegmentedEsportsEventCard(card, vertical)) {
    return card
  }

  const buttonsByConditionId = new Map<string, SportsGamesButton[]>()
  card.buttons.forEach((button) => {
    const currentButtons = buttonsByConditionId.get(button.conditionId)
    if (currentButtons) {
      currentButtons.push(button)
      return
    }

    buttonsByConditionId.set(button.conditionId, [button])
  })

  const rebuiltButtonsByConditionId = new Map<string, SportsGamesButton[]>()
  card.detailMarkets.forEach((market) => {
    const currentButtons = buttonsByConditionId.get(market.condition_id) ?? []
    if (!shouldNormalizeSegmentedEsportsMarketButtons(market, currentButtons)) {
      return
    }

    const rebuiltButtons = buildSegmentedEsportsButtonsFromOutcomes(card, market)
    if (rebuiltButtons.length > 0) {
      rebuiltButtonsByConditionId.set(market.condition_id, rebuiltButtons)
    }
  })

  if (rebuiltButtonsByConditionId.size === 0) {
    return card
  }

  const nextButtons: SportsGamesButton[] = []
  const insertedConditionIds = new Set<string>()

  card.buttons.forEach((button) => {
    const rebuiltButtons = rebuiltButtonsByConditionId.get(button.conditionId)
    if (rebuiltButtons) {
      if (!insertedConditionIds.has(button.conditionId)) {
        nextButtons.push(...rebuiltButtons)
        insertedConditionIds.add(button.conditionId)
      }
      return
    }

    nextButtons.push(button)
  })

  card.detailMarkets.forEach((market) => {
    if (insertedConditionIds.has(market.condition_id)) {
      return
    }

    const rebuiltButtons = rebuiltButtonsByConditionId.get(market.condition_id)
    if (!rebuiltButtons) {
      return
    }

    nextButtons.push(...rebuiltButtons)
    insertedConditionIds.add(market.condition_id)
  })

  return {
    ...card,
    buttons: nextButtons,
  }
}

function resolveTeamByTone(card: SportsGamesCard, tone: SportsGamesButton['tone']) {
  if (tone === 'team1') {
    return card.teams[0] ?? null
  }
  if (tone === 'team2') {
    return card.teams[1] ?? null
  }
  return null
}

export function resolveRedeemOptionLabel(
  card: SportsGamesCard,
  market: SportsGamesCard['detailMarkets'][number],
  button: SportsGamesButton,
) {
  const rawLabel = button.label?.trim() ?? ''
  const team = resolveTeamByTone(card, button.tone)

  if (team?.name) {
    const firstToken = rawLabel.split(/\s+/)[0] ?? ''
    const normalizedFirstToken = normalizeComparableToken(firstToken)
    const normalizedTeamAbbreviation = normalizeComparableToken(team.abbreviation)
    const normalizedTeamName = normalizeComparableToken(team.name)

    if (normalizedFirstToken && (
      (normalizedTeamAbbreviation && normalizedFirstToken === normalizedTeamAbbreviation)
      || (normalizedTeamName && normalizedTeamName.startsWith(normalizedFirstToken))
    )) {
      return `${team.name}${rawLabel.slice(firstToken.length)}`
    }

    return team.name
  }

  if (button.tone === 'draw') {
    return 'Draw'
  }

  if (button.tone === 'over') {
    return rawLabel || 'Over'
  }

  if (button.tone === 'under') {
    return rawLabel || 'Under'
  }

  return market.sports_group_item_title?.trim()
    || market.short_title?.trim()
    || market.title
    || rawLabel
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null
  }

  let normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (!normalized.startsWith('#')) {
    normalized = `#${normalized}`
  }

  if (/^#[0-9A-F]{3}$/i.test(normalized) || /^#[0-9A-F]{6}$/i.test(normalized)) {
    return normalized
  }

  return null
}

function resolveHexToRgbComponents(value: string) {
  const hex = value.replace('#', '')
  const expandedHex = hex.length === 3
    ? hex.split('').map(char => `${char}${char}`).join('')
    : hex

  const red = Number.parseInt(expandedHex.slice(0, 2), 16)
  const green = Number.parseInt(expandedHex.slice(2, 4), 16)
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16)
  if ([red, green, blue].some(component => Number.isNaN(component))) {
    return null
  }

  return `${red} ${green} ${blue}`
}

export function resolveRedeemTagAccent(
  button: SportsGamesButton | null,
  outcomeIndex: number | null,
) {
  const normalizedTeamColor = normalizeHexColor(button?.color)
  if (
    button
    && (button.tone === 'team1' || button.tone === 'team2')
    && normalizedTeamColor
  ) {
    const rgbComponents = resolveHexToRgbComponents(normalizedTeamColor)
    const readableTeamColor = ensureReadableTextColorOnDark(normalizedTeamColor)
    return {
      badgeClassName: '',
      badgeStyle: {
        color: readableTeamColor ?? normalizedTeamColor,
        backgroundColor: rgbComponents ? `rgb(${rgbComponents} / 0.10)` : undefined,
      } as const,
    }
  }

  if ((button && button.tone === 'over') || outcomeIndex === OUTCOME_INDEX.YES) {
    return {
      badgeClassName: 'bg-yes/10 text-yes',
      badgeStyle: undefined,
    }
  }

  if ((button && button.tone === 'under') || outcomeIndex === OUTCOME_INDEX.NO) {
    return {
      badgeClassName: 'bg-no/10 text-no',
      badgeStyle: undefined,
    }
  }

  return {
    badgeClassName: 'bg-muted/60 text-muted-foreground',
    badgeStyle: undefined,
  }
}

export function normalizeLivestreamUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  }
  catch {
    return null
  }
}

export function sortSectionButtons(sectionKey: EventSectionKey, buttons: SportsGamesButton[]) {
  if (sectionKey === 'spread') {
    const order: Record<SportsGamesButton['tone'], number> = {
      team1: 0,
      team2: 1,
      draw: 2,
      over: 3,
      under: 4,
      neutral: 5,
    }

    return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
  }

  if (sectionKey === 'total' || sectionKey === 'btts') {
    const order: Record<SportsGamesButton['tone'], number> = {
      over: 0,
      under: 1,
      team1: 2,
      team2: 3,
      draw: 4,
      neutral: 5,
    }

    return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
  }

  return buttons
}

export function sortAuxiliaryButtons(buttons: SportsGamesButton[]) {
  const order: Record<SportsGamesButton['tone'], number> = {
    team1: 0,
    draw: 1,
    team2: 2,
    over: 3,
    under: 4,
    neutral: 5,
  }

  return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
}

function isEventSectionKey(value: SportsGamesButton['marketType']): value is EventSectionKey {
  return value === 'moneyline' || value === 'spread' || value === 'total' || value === 'btts'
}

export function resolveEventSectionKeyForButton(
  button: SportsGamesButton | null | undefined,
  market: SportsGamesCard['detailMarkets'][number] | null | undefined,
): EventSectionKey | null {
  if (market) {
    if (isSegmentedEsportsChildMoneylineMarket(market) || isSegmentedEsportsBinaryMarket(market)) {
      return null
    }

    const normalizedType = normalizeSportsMarketType(market.sports_market_type)
    if (isSegmentedEsportsPrimaryMoneylineMarket(market) || normalizedType === 'moneyline') {
      return 'moneyline'
    }

    if (
      normalizedType === 'spread'
      || normalizedType === 'map_handicap'
      || normalizedType.includes('handicap')
    ) {
      return 'spread'
    }

    if (
      normalizedType === 'total'
      || normalizedType === 'totals'
      || normalizedType.includes('total')
    ) {
      return 'total'
    }

    if (
      normalizedType === 'btts'
      || normalizedType.includes('both_teams_to_score')
      || normalizedType.includes('both teams to score')
    ) {
      return 'btts'
    }
  }

  if (!button) {
    return null
  }

  if (button.marketType === 'binary') {
    return 'moneyline'
  }

  return isEventSectionKey(button.marketType) ? button.marketType : null
}

export function resolveMarketViewCardBySlug(
  marketViewCards: SportsGamesCardMarketView[],
  marketSlug: string | null,
) {
  if (!marketSlug) {
    return null
  }

  return marketViewCards.find(view =>
    view.card.detailMarkets.some(market => market.slug === marketSlug),
  ) ?? null
}

export function dedupeAuxiliaryButtons(buttons: SportsGamesButton[]) {
  const byKey = new Map<string, SportsGamesButton>()
  buttons.forEach((button) => {
    byKey.set(button.key, button)
  })
  return Array.from(byKey.values())
}

export function resolveAuxiliaryPanelCreatedAt(markets: SportsGamesCard['detailMarkets']) {
  return markets.reduce<number>((earliestTimestamp, market) => {
    const timestamp = Date.parse(market.created_at)
    if (!Number.isFinite(timestamp)) {
      return earliestTimestamp
    }

    return Math.min(earliestTimestamp, timestamp)
  }, Number.POSITIVE_INFINITY)
}

export function resolveAuxiliaryPanelThreshold(markets: SportsGamesCard['detailMarkets']) {
  return markets.reduce<number>((lowestThreshold, market) => {
    const threshold = Number(market.sports_group_item_threshold)
    if (!Number.isFinite(threshold)) {
      return lowestThreshold
    }

    return Math.min(lowestThreshold, threshold)
  }, Number.POSITIVE_INFINITY)
}

import type { CSSProperties } from 'react'
import type {
  LinePickerMarketType,
  SportsGamesMarketType,
  SportsGraphSeriesTarget,
  SportsLinePickerOption,
  SportsTradeFlowLabelItem,
} from './sports-games-center-types'
import type { EventOrderPanelOutcomeSelectedAccent }
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeButton'
import type { SportsGamesButton, SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { OddsFormat } from '@/lib/odds-format'
import type { SportsVertical } from '@/lib/sports-vertical'
import type { Market, Outcome, UserPosition } from '@/types'
import { MICRO_UNIT, OUTCOME_INDEX } from '@/lib/constants'
import {
  formatSharePriceLabel,
  fromMicro,
} from '@/lib/formatters'
import { resolveOutcomePriceCents } from '@/lib/market-pricing'
import { ODDS_FORMAT_OPTIONS } from '@/lib/odds-format'
import {
  isSportsTeamTone,
  resolveSportsTeamFallbackButtonStyle,
  resolveSportsTeamFallbackColor,
  resolveSportsTeamFallbackDepthStyle,
  resolveSportsTeamFallbackOverlayStyle,
} from '@/lib/sports-team-colors'
import { resolveSportsVerticalFromTags } from '@/lib/sports-vertical'
import {
  COMPACT_COMBAT_TRADE_HEADER_SPORT_SLUGS,
  COMPACT_FRANCHISE_TRADE_HEADER_SPORT_SLUGS,
  FRANCHISE_MULTI_WORD_NICKNAME_PREFIXES,
  GENERIC_SPORTS_CATEGORY_LABELS,
  SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY,
  SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY,
  SPORTS_LIVE_FALLBACK_WINDOW_MS,
  TRADE_FLOW_MAX_ITEMS,
  TRADE_FLOW_TTL_MS,
} from './sports-games-center-constants'

export function resolveInitialSportsEventOddsFormat(): OddsFormat {
  if (typeof window === 'undefined') {
    return 'price'
  }

  const storedOddsFormat = window.localStorage.getItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY)
  const matchedOption = ODDS_FORMAT_OPTIONS.find(option => option.value === storedOddsFormat)
  return matchedOption?.value ?? 'price'
}

export function resolveInitialShowSpreadsAndTotals() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY) === '1'
}

export function toFiniteNumber(value: unknown) {
  if (value == null) {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function resolvePositionShares(position: UserPosition) {
  const quantity = toFiniteNumber(position.size)
    ?? (typeof position.total_shares === 'number' ? position.total_shares : 0)
  return Number.isFinite(quantity) ? quantity : 0
}

export function normalizePositionPrice(value: unknown) {
  const numeric = toFiniteNumber(value)
  if (numeric == null || numeric <= 0) {
    return numeric
  }

  let normalized = numeric
  while (normalized > 1) {
    normalized /= 100
  }

  return normalized
}

export function resolvePositionCostValue(position: UserPosition, shares: number, avgPrice: number | null) {
  const derivedCost = shares > 0 && typeof avgPrice === 'number' && avgPrice > 0 ? avgPrice * shares : null
  if (derivedCost != null) {
    return derivedCost
  }

  const baseCostValue = toFiniteNumber(position.totalBought)
    ?? toFiniteNumber(position.initialValue)
    ?? (typeof position.total_position_cost === 'number'
      ? Number(fromMicro(String(position.total_position_cost), 2))
      : null)

  return baseCostValue
}

export function resolvePositionCurrentValue(
  position: UserPosition,
  shares: number,
  avgPrice: number | null,
  marketPrice: number | null,
) {
  if (shares > 0) {
    const livePrice = marketPrice ?? normalizePositionPrice(position.curPrice)
    if (livePrice && livePrice > 0) {
      return livePrice * shares
    }
  }

  let value = toFiniteNumber(position.currentValue)
    ?? Number(fromMicro(String(position.total_position_value ?? 0), 2))

  if (!(value > 0) && shares > 0) {
    if (typeof avgPrice === 'number' && avgPrice > 0) {
      value = avgPrice * shares
    }
  }

  return Number.isFinite(value) ? value : 0
}

export function normalizePositionPnlValue(value: number | null, baseCostValue: number | null) {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (!baseCostValue || baseCostValue <= 0) {
    return value ?? 0
  }
  if (Math.abs(value ?? 0) <= baseCostValue * 10) {
    return value ?? 0
  }
  const scaled = (value ?? 0) / MICRO_UNIT
  if (Math.abs(scaled) <= baseCostValue * 10) {
    return scaled
  }
  return 0
}

export function buildTradeFlowLabel(price: number, size: number) {
  const notional = price * size
  if (!Number.isFinite(notional) || notional <= 0) {
    return null
  }
  return formatSharePriceLabel(notional / 100, { fallback: '0¢', currencyDigits: 0 })
}

export function pruneTradeFlowItems(items: SportsTradeFlowLabelItem[], now: number) {
  return items.filter(item => now - item.createdAt <= TRADE_FLOW_TTL_MS)
}

export function trimTradeFlowItems(items: SportsTradeFlowLabelItem[]) {
  return items.slice(-TRADE_FLOW_MAX_ITEMS)
}

export function resolveMarketTypeLabel(
  button: SportsGamesButton | null,
  market: Market,
): 'Moneyline' | 'Spread' | 'Total' | 'Both Teams to Score' | 'Market' {
  if (button?.marketType === 'moneyline') {
    return 'Moneyline'
  }
  if (button?.marketType === 'spread') {
    return 'Spread'
  }
  if (button?.marketType === 'total') {
    return 'Total'
  }
  if (button?.marketType === 'btts') {
    return 'Both Teams to Score'
  }
  if (button?.marketType === 'binary') {
    return 'Market'
  }

  const normalizedType = normalizeComparableText(market.sports_market_type)
  if (normalizedType.includes('both teams to score') || normalizedType.includes('btts')) {
    return 'Both Teams to Score'
  }
  if (normalizedType.includes('spread') || normalizedType.includes('handicap')) {
    return 'Spread'
  }
  if (normalizedType.includes('total') || normalizedType.includes('over under')) {
    return 'Total'
  }

  return 'Market'
}

export function formatCompactCentsLabel(cents: number | null) {
  if (cents == null || !Number.isFinite(cents)) {
    return '—'
  }

  const rounded = Math.round(cents * 10) / 10
  return Number.isInteger(rounded)
    ? `${rounded}c`
    : `${rounded.toFixed(1)}c`
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash) ? withHash : null
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

export function resolveButtonStyle(
  color: string | null,
  tone?: SportsGamesButton['tone'],
): CSSProperties | undefined {
  const normalized = normalizeHexColor(color)
  if (!normalized) {
    if (!isSportsTeamTone(tone)) {
      return undefined
    }

    return resolveSportsTeamFallbackButtonStyle(tone)
  }

  return {
    backgroundColor: normalized,
    color: '#fff',
  }
}

export function resolveButtonDepthStyle(
  color: string | null,
  tone?: SportsGamesButton['tone'],
): CSSProperties | undefined {
  const normalized = normalizeHexColor(color)
  if (!normalized) {
    if (!isSportsTeamTone(tone)) {
      return undefined
    }

    return resolveSportsTeamFallbackDepthStyle(tone)
  }

  const hex = normalized.replace('#', '')
  const expandedHex = hex.length === 3
    ? hex.split('').map(char => `${char}${char}`).join('')
    : hex

  const red = Number.parseInt(expandedHex.slice(0, 2), 16)
  const green = Number.parseInt(expandedHex.slice(2, 4), 16)
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16)

  if ([red, green, blue].some(value => Number.isNaN(value))) {
    return undefined
  }

  return {
    backgroundColor: `rgb(${red} ${green} ${blue} / 0.8)`,
  }
}

export function resolveButtonOverlayStyle(
  color: string | null,
  tone?: SportsGamesButton['tone'],
): CSSProperties | undefined {
  const normalized = normalizeHexColor(color)
  if (normalized || !isSportsTeamTone(tone)) {
    return undefined
  }

  return resolveSportsTeamFallbackOverlayStyle(tone)
}

export function normalizeOutcomePriceCents(outcome: Outcome | null | undefined, market: Market) {
  const outcomeIndex = outcome?.outcome_index === OUTCOME_INDEX.NO
    ? OUTCOME_INDEX.NO
    : OUTCOME_INDEX.YES

  return resolveOutcomePriceCents(market, outcomeIndex) ?? 50
}

export function groupButtonsByMarketType(buttons: SportsGamesButton[]) {
  const grouped: Record<SportsGamesMarketType, SportsGamesButton[]> = {
    moneyline: [],
    spread: [],
    total: [],
    btts: [],
    binary: [],
  }

  for (const button of buttons) {
    grouped[button.marketType].push(button)
  }

  return grouped
}

export function toDateGroupKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveDefaultConditionId(card: SportsGamesCard) {
  return card.defaultConditionId
    ?? card.buttons[0]?.key
    ?? card.detailMarkets[0]?.condition_id
    ?? null
}

export function resolveSelectedButton(card: SportsGamesCard, selectedButtonKey: string | null) {
  if (selectedButtonKey) {
    const selected = card.buttons.find(button => button.key === selectedButtonKey)
    if (selected) {
      return selected
    }
  }

  return card.buttons[0] ?? null
}

export function resolveSelectedMarket(card: SportsGamesCard, selectedButtonKey: string | null) {
  const selectedButton = resolveSelectedButton(card, selectedButtonKey)
  if (selectedButton) {
    const selectedMarket = card.detailMarkets.find(market => market.condition_id === selectedButton.conditionId)
    if (selectedMarket) {
      return selectedMarket
    }
  }

  return card.detailMarkets[0] ?? null
}

export function resolveOrderPanelOutcomeLabelOverrides(
  card: SportsGamesCard,
  market: Market | null | undefined,
): Partial<Record<number, string>> {
  if (!market) {
    return {}
  }

  const hasDrawMoneylineOption = card.buttons.some(button =>
    button.marketType === 'moneyline' && button.tone === 'draw',
  )
  const isMoneylineCondition = card.buttons.some(button =>
    button.conditionId === market.condition_id && button.marketType === 'moneyline',
  )
  if (hasDrawMoneylineOption && isMoneylineCondition) {
    return {}
  }

  const labels: Partial<Record<number, string>> = {}
  card.buttons.forEach((button) => {
    if (button.conditionId !== market.condition_id || button.tone === 'draw') {
      return
    }

    const label = button.label?.trim()
    if (!label || labels[button.outcomeIndex]) {
      return
    }

    labels[button.outcomeIndex] = label
  })

  return labels
}

export function resolveOrderPanelOutcomeAccentOverrides(
  card: SportsGamesCard,
  market: Market | null | undefined,
): Partial<Record<number, EventOrderPanelOutcomeSelectedAccent>> {
  if (!market) {
    return {}
  }

  const accents: Partial<Record<number, EventOrderPanelOutcomeSelectedAccent>> = {}
  card.buttons.forEach((button) => {
    if (
      button.conditionId !== market.condition_id
      || (button.outcomeIndex !== OUTCOME_INDEX.YES && button.outcomeIndex !== OUTCOME_INDEX.NO)
      || (button.tone !== 'team1' && button.tone !== 'team2')
      || accents[button.outcomeIndex]
    ) {
      return
    }

    accents[button.outcomeIndex] = {
      buttonStyle: resolveButtonStyle(button.color, button.tone),
      depthStyle: resolveButtonDepthStyle(button.color, button.tone),
      overlayStyle: resolveButtonOverlayStyle(button.color, button.tone),
    }
  })

  return accents
}

export function resolveActiveMarketType(card: SportsGamesCard, selectedButtonKey: string | null): SportsGamesMarketType {
  if (selectedButtonKey) {
    const selectedButton = card.buttons.find(button => button.key === selectedButtonKey)
    if (selectedButton) {
      return selectedButton.marketType
    }
  }

  return card.buttons[0]?.marketType ?? 'moneyline'
}

export function resolveSelectedOutcome(market: Market | null, selectedButton: SportsGamesButton | null): Outcome | null {
  if (!market) {
    return null
  }

  if (selectedButton) {
    const selectedOutcome = market.outcomes.find(outcome => outcome.outcome_index === selectedButton.outcomeIndex)
    if (selectedOutcome) {
      return selectedOutcome
    }
  }

  return market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
    ?? market.outcomes[0]
    ?? null
}

export function resolveStableSpreadPrimaryOutcomeIndex(card: SportsGamesCard, conditionId: string) {
  const spreadButtonsForCondition = card.buttons
    .filter(button => button.marketType === 'spread' && button.conditionId === conditionId)
    .map(button => button.outcomeIndex)
    .filter((index): index is number => index === OUTCOME_INDEX.YES || index === OUTCOME_INDEX.NO)
  const uniqueButtonIndices = Array.from(new Set(spreadButtonsForCondition)).sort((a, b) => a - b)

  // Spread in sports is rendered with inverted side order in the order panel
  // compared to outcome index ordering, so pick the opposite side as primary.
  if (uniqueButtonIndices.length >= 2) {
    return uniqueButtonIndices[1]
  }
  if (uniqueButtonIndices.length === 1) {
    return uniqueButtonIndices[0]
  }

  const market = card.detailMarkets.find(item => item.condition_id === conditionId)
  if (!market) {
    return null
  }

  const marketIndices = Array.from(market.outcomes, outcome => outcome.outcome_index)
    .filter((index): index is number => index === OUTCOME_INDEX.YES || index === OUTCOME_INDEX.NO)
  const uniqueMarketIndices = Array.from(new Set(marketIndices)).sort((a, b) => a - b)

  if (uniqueMarketIndices.length >= 2) {
    return uniqueMarketIndices[1]
  }
  if (uniqueMarketIndices.length === 1) {
    return uniqueMarketIndices[0]
  }

  return null
}

function extractLineValue(value: string) {
  const match = value.match(/([+-]?\d+(?:\.\d+)?)/)
  return match?.[1] ?? null
}

function formatLineValue(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`
}

function toLineNumber(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.abs(parsed) : null
}

function resolveMarketLineValue(market: Market | null, marketType: LinePickerMarketType) {
  if (!market) {
    return null
  }

  const marketText = [
    market.sports_group_item_title,
    market.short_title,
    market.title,
    ...market.outcomes.map(outcome => outcome.outcome_text),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')

  const rawLine = extractLineValue(marketText)
  if (!rawLine) {
    return null
  }

  const lineValue = toLineNumber(rawLine)
  if (lineValue === null) {
    return null
  }

  return marketType === 'spread'
    ? lineValue
    : lineValue
}

export function buildLinePickerOptions(card: SportsGamesCard, marketType: LinePickerMarketType): SportsLinePickerOption[] {
  const sourceButtons = card.buttons.filter(button => button.marketType === marketType)
  if (sourceButtons.length === 0) {
    return []
  }

  const marketByConditionId = new Map(card.detailMarkets.map(market => [market.condition_id, market] as const))
  const byCondition = new Map<string, SportsLinePickerOption>()

  sourceButtons.forEach((button, index) => {
    const existing = byCondition.get(button.conditionId)
    if (existing) {
      existing.buttons.push(button)
      return
    }

    const market = marketByConditionId.get(button.conditionId) ?? null
    const fromMarket = resolveMarketLineValue(market, marketType)
    const fromButton = toLineNumber(extractLineValue(button.label))
    const lineValue = fromMarket ?? fromButton
    if (lineValue === null) {
      return
    }

    byCondition.set(button.conditionId, {
      conditionId: button.conditionId,
      label: formatLineValue(lineValue),
      lineValue,
      firstIndex: index,
      buttons: [button],
    })
  })

  return Array.from(byCondition.values())
    .sort((a, b) => {
      if (a.lineValue !== b.lineValue) {
        return a.lineValue - b.lineValue
      }
      return a.firstIndex - b.firstIndex
    })
}

export function resolvePreferredLinePickerButton(
  buttons: SportsGamesButton[],
  selectedButton: SportsGamesButton | null | undefined,
) {
  if (buttons.length === 0) {
    return null
  }

  if (!selectedButton) {
    return buttons[0] ?? null
  }

  if (selectedButton.tone !== 'neutral') {
    const toneMatch = buttons.find(button => button.tone === selectedButton.tone)
    if (toneMatch) {
      return toneMatch
    }
  }

  const outcomeIndexMatch = buttons.find(button => button.outcomeIndex === selectedButton.outcomeIndex)
  if (outcomeIndexMatch) {
    return outcomeIndexMatch
  }

  return buttons[0] ?? null
}

export function resolveGraphSeriesName(card: SportsGamesCard, button: SportsGamesButton | undefined, market: Market) {
  if (!button) {
    return market.sports_group_item_title?.trim()
      || market.short_title?.trim()
      || market.title
  }

  if (button.tone === 'team1') {
    return card.teams[0]?.name ?? button.label
  }
  if (button.tone === 'team2') {
    return card.teams[1]?.name ?? button.label
  }
  if (button.tone === 'draw') {
    return 'Draw'
  }

  return button.label
}

export function resolveGraphSeriesColor(
  card: SportsGamesCard,
  button: SportsGamesButton | undefined,
  fallbackColor: string,
) {
  const relatedColor = normalizeHexColor(button?.color)
  if (relatedColor) {
    return relatedColor
  }

  const relatedTeamColor = normalizeHexColor(
    button ? resolveTeamByTone(card, button.tone)?.color : null,
  )
  if (relatedTeamColor) {
    return relatedTeamColor
  }
  if (button && isSportsTeamTone(button.tone)) {
    return resolveSportsTeamFallbackColor(button.tone)
  }

  if (button?.tone === 'over') {
    return 'var(--yes)'
  }
  if (button?.tone === 'under') {
    return 'var(--no)'
  }
  if (button?.tone === 'draw') {
    return 'var(--secondary-foreground)'
  }

  return fallbackColor
}

export function buildCompositeMoneylineGraphTargets(card: SportsGamesCard) {
  const moneylineButtons = card.buttons.filter(button => button.marketType === 'moneyline')
  if (moneylineButtons.length < 2) {
    return [] as SportsGraphSeriesTarget[]
  }

  const moneylineConditionIds = Array.from(new Set(moneylineButtons.map(button => button.conditionId)))
  if (moneylineConditionIds.length !== 1) {
    return [] as SportsGraphSeriesTarget[]
  }

  const market = card.detailMarkets.find(
    detailMarket => detailMarket.condition_id === moneylineConditionIds[0],
  ) ?? null
  if (!market) {
    return [] as SportsGraphSeriesTarget[]
  }

  const orderedButtons = [...moneylineButtons].sort((left, right) => {
    const toneOrder: Record<SportsGamesButton['tone'], number> = {
      team1: 0,
      draw: 1,
      team2: 2,
      over: 3,
      under: 4,
      neutral: 5,
    }

    return (toneOrder[left.tone] ?? 99) - (toneOrder[right.tone] ?? 99)
  })

  const fallbackColors = ['var(--yes)', 'var(--secondary-foreground)', 'var(--no)']

  return orderedButtons.reduce<SportsGraphSeriesTarget[]>((targets, button, index) => {
    const outcome = market.outcomes.find(
      candidate => candidate.outcome_index === button.outcomeIndex,
    ) ?? null

    if (!outcome?.token_id) {
      return targets
    }

    targets.push({
      key: `${market.condition_id}:${button.outcomeIndex}`,
      tokenId: outcome.token_id,
      market,
      outcomeIndex: button.outcomeIndex,
      name: resolveGraphSeriesName(card, button, market),
      color: resolveGraphSeriesColor(card, button, fallbackColors[index % fallbackColors.length]!),
    })

    return targets
  }, [])
}

function resolveTotalButtonLabel(button: SportsGamesButton, selectedOutcome: Outcome | null) {
  const line = extractLineValue(button.label)
  const outcomeText = selectedOutcome?.outcome_text?.trim() ?? ''

  let sideLabel: 'OVER' | 'UNDER'
  if (/^under$/i.test(outcomeText) || button.tone === 'under') {
    sideLabel = 'UNDER'
  }
  else if (/^over$/i.test(outcomeText) || button.tone === 'over') {
    sideLabel = 'OVER'
  }
  else {
    sideLabel = button.label.trim().toUpperCase().startsWith('U') ? 'UNDER' : 'OVER'
  }

  return line ? `${sideLabel} ${line}` : sideLabel
}

export function resolveSelectedTradeLabel(
  card: SportsGamesCard,
  button: SportsGamesButton | null,
  selectedOutcome: Outcome | null,
) {
  if (!button) {
    return selectedOutcome?.outcome_text?.trim().toUpperCase() || 'YES'
  }

  if (button.marketType === 'total') {
    return resolveTotalButtonLabel(button, selectedOutcome)
  }

  if (button.marketType === 'moneyline' && (button.tone === 'team1' || button.tone === 'team2')) {
    const teamName = resolveTeamByTone(card, button.tone)?.name?.trim()
    if (teamName) {
      return teamName
    }
  }

  return button.label.trim().toUpperCase()
}

function resolveMarketDescriptor(market: Market | null) {
  if (!market) {
    return null
  }

  const descriptor = market.sports_group_item_title?.trim()
    || market.short_title?.trim()
    || market.title?.trim()
    || ''
  return descriptor || null
}

export function normalizeComparableText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

function toFiniteTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NaN
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

export function resolveCardStartTimestamp(card: SportsGamesCard) {
  return toFiniteTimestamp(
    card.startTime
    ?? card.event.sports_start_time
    ?? card.event.start_date,
  )
}

function resolveCardEndTimestamp(card: SportsGamesCard) {
  const explicitEnd = toFiniteTimestamp(card.event.end_date)
  if (Number.isFinite(explicitEnd)) {
    return explicitEnd
  }

  const marketEndTimes = card.detailMarkets
    .map(market => toFiniteTimestamp(market.end_time ?? null))
    .filter(timestamp => Number.isFinite(timestamp))

  if (marketEndTimes.length > 0) {
    return Math.max(...marketEndTimes)
  }

  return Number.NaN
}

function resolveCardLiveFallbackEndTimestamp(card: SportsGamesCard) {
  const startMs = resolveCardStartTimestamp(card)
  if (!Number.isFinite(startMs)) {
    return Number.NaN
  }

  const endMs = resolveCardEndTimestamp(card)
  const referenceEndMs = Number.isFinite(endMs) && endMs > startMs
    ? endMs
    : startMs

  return referenceEndMs + SPORTS_LIVE_FALLBACK_WINDOW_MS
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

export function isCardLiveNow(card: SportsGamesCard, nowMs: number) {
  if (card.event.status !== 'active' || card.event.sports_ended === true) {
    return false
  }

  const startMs = resolveCardStartTimestamp(card)
  const endMs = resolveCardEndTimestamp(card)
  const isInTimeWindow = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? startMs <= nowMs && nowMs <= endMs
    : false
  const liveFallbackEndMs = resolveCardLiveFallbackEndTimestamp(card)
  const isWithinFallbackWindow = Number.isFinite(startMs) && Number.isFinite(liveFallbackEndMs)
    ? startMs <= nowMs && nowMs <= liveFallbackEndMs
    : false

  if (card.event.sports_live === true) {
    return true
  }

  return isInTimeWindow || isWithinFallbackWindow
}

export function isCardFuture(card: SportsGamesCard, nowMs: number) {
  if (card.event.status !== 'active') {
    return false
  }

  const startMs = resolveCardStartTimestamp(card)
  return Number.isFinite(startMs) && startMs > nowMs
}

function formatCategoryFromSlug(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function resolveCategoryFromSportSlugs(card: SportsGamesCard) {
  const categorySlug = card.event.sports_sport_slug?.trim() || card.event.sports_series_slug?.trim()
  if (!categorySlug) {
    return null
  }

  return formatCategoryFromSlug(categorySlug)
}

function resolveCategoryFromEventSlug(card: SportsGamesCard) {
  const eventSlug = card.event.sports_event_slug?.trim() || card.event.series_slug?.trim()
  if (!eventSlug) {
    return null
  }

  const cleaned = eventSlug
    .replace(/-games?$/i, '')
    .replace(/-live$/i, '')
    .replace(/-props$/i, '')
  if (!cleaned) {
    return null
  }

  const sportSlug = card.event.sports_sport_slug?.trim().toLowerCase()
  const tokens = cleaned.split('-').filter(Boolean)
  const normalizedTokens = sportSlug
    ? tokens.filter(token => token.toLowerCase() !== sportSlug)
    : tokens
  const candidate = normalizedTokens.join('-')

  return candidate ? formatCategoryFromSlug(candidate) : null
}

function isGenericSportsCategoryLabel(label: string, sportSlug: string | null | undefined) {
  const normalized = normalizeComparableText(label)
  if (!normalized) {
    return true
  }

  if (GENERIC_SPORTS_CATEGORY_LABELS.has(normalized)) {
    return true
  }

  if (!sportSlug) {
    return false
  }

  const normalizedSportSlug = normalizeComparableText(sportSlug.replace(/-/g, ' '))
  return normalized === normalizedSportSlug
}

export function resolveCardCategoryLabel(
  card: SportsGamesCard,
  categoryTitleBySlug: Record<string, string> = {},
) {
  const categorySlugCandidates = [
    card.event.sports_series_slug,
    card.event.series_slug,
    card.event.sports_sport_slug,
  ]
    .map(value => value?.trim().toLowerCase() ?? '')
    .filter(Boolean)

  for (const slug of categorySlugCandidates) {
    const mappedCategoryTitle = categoryTitleBySlug[slug]
    if (
      mappedCategoryTitle
      && !isGenericSportsCategoryLabel(mappedCategoryTitle, slug)
    ) {
      return mappedCategoryTitle
    }
  }

  const genericSlug = categorySlugCandidates[0] ?? card.event.sports_sport_slug
  const candidateTags = card.event.sports_tags
    ?.map(tag => tag?.trim() ?? '')
    .filter(Boolean)
    .filter(tag => !isGenericSportsCategoryLabel(tag, genericSlug))
    ?? []

  if (candidateTags.length > 0) {
    return [...candidateTags].sort((a, b) => b.length - a.length)[0]!
  }

  return resolveCategoryFromSportSlugs(card)
    ?? resolveCategoryFromEventSlug(card)
    ?? 'Other'
}

export function resolveSwitchTooltip(market: Market | null, nextOutcome: Outcome | null) {
  if (!nextOutcome) {
    return null
  }

  const nextOutcomeLabel = nextOutcome.outcome_text?.trim() || null
  if (!nextOutcomeLabel) {
    return null
  }

  const marketDescriptor = resolveMarketDescriptor(market)
  if (!marketDescriptor) {
    return `Switch to ${nextOutcomeLabel}`
  }

  const normalizedOutcome = normalizeComparableText(nextOutcomeLabel)
  const normalizedDescriptor = normalizeComparableText(marketDescriptor)
  if (!normalizedDescriptor || normalizedDescriptor === normalizedOutcome) {
    return `Switch to ${nextOutcomeLabel}`
  }

  return `Switch to ${nextOutcomeLabel} - ${marketDescriptor}`
}

function resolveTeamShortLabel(name: string | null | undefined, abbreviation: string | null | undefined) {
  const normalizedAbbreviation = abbreviation
    ?.trim()
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
  if (normalizedAbbreviation) {
    return normalizedAbbreviation
  }

  const compactName = name
    ?.trim()
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
  if (!compactName) {
    return null
  }

  return compactName.slice(0, 3)
}

function resolveFranchiseTradeHeaderTeamLabel(
  name: string | null | undefined,
  abbreviation: string | null | undefined,
) {
  const trimmedName = name?.trim()
  if (!trimmedName) {
    return resolveTeamShortLabel(name, abbreviation)
  }

  const nameTokens = trimmedName.split(/\s+/).filter(Boolean)
  if (nameTokens.length <= 1) {
    return trimmedName
  }

  const lastToken = nameTokens.at(-1)
  const secondToLastToken = nameTokens.at(-2)
  if (!lastToken) {
    return resolveTeamShortLabel(name, abbreviation)
  }

  if (
    secondToLastToken
    && FRANCHISE_MULTI_WORD_NICKNAME_PREFIXES.has(normalizeComparableText(secondToLastToken))
  ) {
    return `${secondToLastToken} ${lastToken}`
  }

  return lastToken
}

function resolveEsportsTradeHeaderTeamLabel(
  name: string | null | undefined,
  abbreviation: string | null | undefined,
) {
  const trimmedAbbreviation = abbreviation?.trim()
  if (trimmedAbbreviation) {
    return trimmedAbbreviation
      .toUpperCase()
      .replace(/[_-]+/g, ' ')
      .replace(/([A-Z]+)(\d+)$/u, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return resolveTeamShortLabel(name, abbreviation)
}

function resolveTradeHeaderSportSlugCandidates(card: SportsGamesCard) {
  return [
    card.event.sports_sport_slug,
    card.event.sports_series_slug,
  ]
    .map(value => normalizeComparableText(value))
    .filter((value): value is string => Boolean(value))
}

function isCompactCricketTradeHeaderSportSlug(slug: string) {
  return slug === 'cricket' || slug === 'crint' || slug.startsWith('cric')
}

function shouldUseFranchiseTradeHeaderTeamLabels(sportSlugs: string[]) {
  return sportSlugs.some(slug => COMPACT_FRANCHISE_TRADE_HEADER_SPORT_SLUGS.has(slug))
}

function hasDrawMoneylineOption(card: SportsGamesCard) {
  return card.buttons.some(button =>
    button.marketType === 'moneyline' && button.tone === 'draw',
  )
}

function resolveCompactTradeHeaderTitle(
  card: SportsGamesCard,
  resolveTeamLabel: (
    name: string | null | undefined,
    abbreviation: string | null | undefined,
  ) => string | null,
) {
  const team1 = card.teams[0] ?? null
  const team2 = card.teams[1] ?? null
  const leftLabel = resolveTeamLabel(team1?.name, team1?.abbreviation)
  const rightLabel = resolveTeamLabel(team2?.name, team2?.abbreviation)

  if (!leftLabel || !rightLabel) {
    return null
  }

  return `${leftLabel} vs ${rightLabel}`
}

function shouldUseCompactTradeHeaderTitle(card: SportsGamesCard, vertical: SportsVertical | null) {
  if (vertical === 'esports') {
    return true
  }

  if (hasDrawMoneylineOption(card)) {
    return true
  }

  const sportSlugs = resolveTradeHeaderSportSlugCandidates(card)

  return sportSlugs.some(slug =>
    COMPACT_COMBAT_TRADE_HEADER_SPORT_SLUGS.has(slug)
    || COMPACT_FRANCHISE_TRADE_HEADER_SPORT_SLUGS.has(slug)
    || isCompactCricketTradeHeaderSportSlug(slug))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function abbreviatePositionMarketLabel(label: string, teams: SportsGamesCard['teams']) {
  const trimmedLabel = label.trim()
  if (!trimmedLabel) {
    return ''
  }

  let nextLabel = trimmedLabel
  const replacements = teams
    .map(team => ({
      teamName: team.name.trim(),
      shortLabel: resolveTeamShortLabel(team.name, team.abbreviation),
    }))
    .filter(({ teamName, shortLabel }) => teamName.length > 0 && Boolean(shortLabel))
    .sort((a, b) => b.teamName.length - a.teamName.length)

  for (const { teamName, shortLabel } of replacements) {
    nextLabel = nextLabel.replace(new RegExp(escapeRegExp(teamName), 'gi'), shortLabel!)
  }

  return nextLabel.replace(/\s+/g, ' ').trim().toUpperCase()
}

export function resolveTradeHeaderTitle({
  card,
  selectedButton,
  selectedMarket,
  marketType,
}: {
  card: SportsGamesCard
  selectedButton: SportsGamesButton
  selectedMarket: Market | null
  marketType: SportsGamesMarketType
}) {
  const normalizedMarketType = normalizeComparableText(selectedMarket?.sports_market_type)
  if (normalizedMarketType.includes('exact score')) {
    const descriptor = resolveMarketDescriptor(selectedMarket)
    return descriptor ? `Exact Score: ${descriptor}` : 'Exact Score'
  }

  if (marketType === 'btts') {
    return 'Both Teams to Score?'
  }

  if (marketType === 'total') {
    return 'Over vs Under'
  }

  const team1 = card.teams[0] ?? null
  const team2 = card.teams[1] ?? null
  const vertical = resolveSportsVerticalFromTags({
    tags: card.event.tags,
    mainTag: card.event.main_tag,
  })
  if (shouldUseCompactTradeHeaderTitle(card, vertical)) {
    const sportSlugs = resolveTradeHeaderSportSlugCandidates(card)
    const compactTitle = resolveCompactTradeHeaderTitle(
      card,
      vertical === 'esports'
        ? resolveEsportsTradeHeaderTeamLabel
        : shouldUseFranchiseTradeHeaderTeamLabels(sportSlugs)
          ? resolveFranchiseTradeHeaderTeamLabel
          : resolveTeamShortLabel,
    )
    if (compactTitle) {
      return compactTitle
    }
  }

  const fullMatchupTitle = card.title?.trim()
    || [team1?.name?.trim(), team2?.name?.trim()].filter(Boolean).join(' vs ')

  if (fullMatchupTitle) {
    return fullMatchupTitle
  }

  return selectedButton.label.trim().toUpperCase() || card.title
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

export function resolveTradeHeaderBadgeAccent(button: SportsGamesButton) {
  const normalizedTeamColor = normalizeHexColor(button.color)
  if (
    (button.tone === 'team1' || button.tone === 'team2')
    && normalizedTeamColor
  ) {
    const rgbComponents = resolveHexToRgbComponents(normalizedTeamColor)
    return {
      className: 'dark:mix-blend-plus-lighter',
      style: {
        color: normalizedTeamColor,
        backgroundColor: rgbComponents ? `rgb(${rgbComponents} / 0.10)` : undefined,
      } as CSSProperties,
    }
  }

  if (button.tone === 'over') {
    return {
      className: 'bg-yes/10 text-yes',
      style: undefined,
    }
  }

  if (button.tone === 'under') {
    return {
      className: 'bg-no/10 text-no',
      style: undefined,
    }
  }

  return {
    className: 'bg-muted/60 text-muted-foreground',
    style: undefined,
  }
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

export function resolveTeamByTone(card: SportsGamesCard, tone: SportsGamesButton['tone']) {
  if (tone === 'team1') {
    return card.teams[0] ?? null
  }
  if (tone === 'team2') {
    return card.teams[1] ?? null
  }
  return null
}

export function resolveLeadingSpreadTeam(card: SportsGamesCard, button: SportsGamesButton) {
  const firstToken = button.label.split(/\s+/)[0] ?? ''
  const normalizedFirstToken = normalizeComparableToken(firstToken)
  if (normalizedFirstToken) {
    const matchedTeam = card.teams.find((team) => {
      const abbreviationToken = normalizeComparableToken(team.abbreviation)
      if (abbreviationToken && abbreviationToken === normalizedFirstToken) {
        return true
      }

      const nameToken = normalizeComparableToken(team.name)
      return Boolean(nameToken && nameToken.startsWith(normalizedFirstToken))
    })

    if (matchedTeam) {
      return matchedTeam
    }
  }

  return resolveTeamByTone(card, button.tone)
}

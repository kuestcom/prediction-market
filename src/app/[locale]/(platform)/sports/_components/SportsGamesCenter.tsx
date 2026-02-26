'use client'

import type { Route } from 'next'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  MouseEvent as ReactMouseEventType,
} from 'react'
import type { SportsGamesButton, SportsGamesCard } from '@/app/[locale]/(platform)/sports/_components/sports-games-data'
import type { OddsFormat } from '@/lib/odds-format'
import type { NormalizedBookLevel } from '@/lib/order-panel-utils'
import type { Market, Outcome, UserPosition } from '@/types'
import type { DataPoint, PredictionChartCursorSnapshot, PredictionChartProps } from '@/types/PredictionChartTypes'
import { useQuery } from '@tanstack/react-query'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EqualIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SellPositionModal from '@/app/[locale]/(platform)/_components/SellPositionModal'
import EventChartControls, { defaultChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartControls'
import EventChartEmbedDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartEmbedDialog'
import EventChartExportDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartExportDialog'
import EventConvertPositionsDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventConvertPositionsDialog'
import EventOrderBook, { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import { TIME_RANGES, useEventPriceHistory } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { loadStoredChartSettings, storeChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_utils/chartSettingsStorage'
import { fetchOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderBookUtils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useWindowSize } from '@/hooks/useWindowSize'
import { Link, useRouter } from '@/i18n/navigation'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserPositionsForMarket } from '@/lib/data-api/user'
import { formatAmountInputValue, formatCentsLabel, formatCurrency, formatSharesLabel, formatVolume, fromMicro } from '@/lib/formatters'
import { formatOddsFromCents, ODDS_FORMAT_OPTIONS } from '@/lib/odds-format'
import { calculateMarketFill, normalizeBookLevels } from '@/lib/order-panel-utils'
import { calculateYAxisBounds } from '@/lib/prediction-chart'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'

interface SportsGamesCenterProps {
  cards: SportsGamesCard[]
  sportSlug: string
  sportTitle: string
}

type DetailsTab = 'orderBook' | 'graph'
export type SportsGamesMarketType = SportsGamesButton['marketType']
export type SportsGameGraphVariant = 'default' | 'sportsEventHero'
type LinePickerMarketType = Extract<SportsGamesMarketType, 'spread' | 'total'>

const MARKET_COLUMNS: Array<{ key: SportsGamesMarketType, label: string }> = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
]
const headerIconButtonClass = `
  size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors
  hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9
`
const SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY = 'sports:event:odds-format'
const SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY = 'sports:games:show-spreads-totals'

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false },
)

interface SportsLinePickerOption {
  conditionId: string
  label: string
  lineValue: number
  firstIndex: number
  buttons: SportsGamesButton[]
}

interface SportsGraphSeriesTarget {
  key: string
  tokenId: string | null
  market: Market
  outcomeIndex: number
  name: string
  color: string
}

interface SportsTradeSelection {
  cardId: string | null
  buttonKey: string | null
}

interface SportsActiveTradeContext {
  card: SportsGamesCard
  button: SportsGamesButton
  market: Market
  outcome: Outcome
}

interface SportsPositionTag {
  key: string
  conditionId: string
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  marketTypeLabel: 'Moneyline' | 'Spread' | 'Total' | 'Both Teams to Score'
  marketLabel: string
  outcomeLabel: string
  summaryLabel: string
  shares: number
  avgPriceCents: number | null
  totalCost: number | null
  currentValue: number
  market: Market
  outcome: Outcome
  button: SportsGamesButton | null
  latestActivityAtMs: number
}

interface SportsCashOutModalPayload {
  outcomeLabel: string
  outcomeShortLabel: string
  outcomeIconUrl: string | null | undefined
  shares: number
  filledShares: number | null
  avgPriceCents: number | null
  receiveAmount: number | null
  sellBids: NormalizedBookLevel[]
}

function toFiniteNumber(value: unknown) {
  if (value == null) {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function resolvePositionShares(position: UserPosition) {
  const quantity = toFiniteNumber(position.size)
    ?? (typeof position.total_shares === 'number' ? position.total_shares : 0)
  return Number.isFinite(quantity) ? quantity : 0
}

function resolvePositionCostValue(position: UserPosition, shares: number, avgPrice: number | null) {
  const baseCostValue = toFiniteNumber(position.totalBought)
    ?? toFiniteNumber(position.initialValue)
    ?? (typeof position.total_position_cost === 'number'
      ? Number(fromMicro(String(position.total_position_cost), 2))
      : null)
  const derivedCost = shares > 0 && typeof avgPrice === 'number' ? avgPrice * shares : null
  if (derivedCost != null) {
    if (!baseCostValue || baseCostValue <= 0) {
      return derivedCost
    }
    if (derivedCost > 0 && baseCostValue > derivedCost * 10) {
      return derivedCost
    }
  }
  return baseCostValue
}

function resolvePositionCurrentValue(position: UserPosition, shares: number, avgPrice: number | null) {
  let value = toFiniteNumber(position.currentValue)
    ?? Number(fromMicro(String(position.total_position_value ?? 0), 2))

  if (!(value > 0) && shares > 0) {
    const currentPrice = toFiniteNumber(position.curPrice)
    if (currentPrice && currentPrice > 0) {
      value = currentPrice * shares
    }
    else if (typeof avgPrice === 'number' && avgPrice > 0) {
      value = avgPrice * shares
    }
  }

  return Number.isFinite(value) ? value : 0
}

function resolveMarketTypeLabel(
  button: SportsGamesButton | null,
  market: Market,
): 'Moneyline' | 'Spread' | 'Total' | 'Both Teams to Score' {
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

  return 'Moneyline'
}

function formatCompactCentsLabel(cents: number | null) {
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

function normalizeMarketPriceCents(market: Market) {
  const value = Number.isFinite(market.price)
    ? market.price * 100
    : Number.isFinite(market.probability)
      ? market.probability
      : 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

export function resolveButtonStyle(color: string | null): CSSProperties | undefined {
  const normalized = normalizeHexColor(color)
  if (!normalized) {
    return undefined
  }

  return {
    backgroundColor: normalized,
    color: '#fff',
  }
}

export function resolveButtonDepthStyle(color: string | null): CSSProperties | undefined {
  const normalized = normalizeHexColor(color)
  if (!normalized) {
    return undefined
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

function normalizeOutcomePriceCents(outcome: Outcome | null | undefined, market: Market) {
  if (outcome && Number.isFinite(outcome.buy_price)) {
    const value = Number(outcome.buy_price) * 100
    return Math.max(0, Math.min(100, Math.round(value)))
  }

  const yesPrice = normalizeMarketPriceCents(market)
  return outcome?.outcome_index === OUTCOME_INDEX.NO ? Math.max(0, 100 - yesPrice) : yesPrice
}

export function groupButtonsByMarketType(buttons: SportsGamesButton[]) {
  const grouped: Record<SportsGamesMarketType, SportsGamesButton[]> = {
    moneyline: [],
    spread: [],
    total: [],
    btts: [],
  }

  for (const button of buttons) {
    grouped[button.marketType].push(button)
  }

  return grouped
}

function toDateGroupKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
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

function resolveActiveMarketType(card: SportsGamesCard, selectedButtonKey: string | null): SportsGamesMarketType {
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

  const marketIndices = [...market.outcomes]
    .map(outcome => outcome.outcome_index)
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

function buildLinePickerOptions(card: SportsGamesCard, marketType: LinePickerMarketType): SportsLinePickerOption[] {
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

function resolveGraphSeriesName(card: SportsGamesCard, button: SportsGamesButton | undefined, market: Market) {
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

function resolveGraphSeriesColor(
  button: SportsGamesButton | undefined,
  fallbackColor: string,
) {
  const relatedColor = normalizeHexColor(button?.color)
  if (relatedColor) {
    return relatedColor
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

function resolveSelectedTradeLabel(button: SportsGamesButton | null, selectedOutcome: Outcome | null) {
  if (!button) {
    return selectedOutcome?.outcome_text?.trim().toUpperCase() || 'YES'
  }

  if (button.marketType === 'total') {
    return resolveTotalButtonLabel(button, selectedOutcome)
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

function normalizeComparableText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

function resolveSwitchTooltip(market: Market | null, nextOutcome: Outcome | null) {
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

export function SportsGameGraph({
  card,
  selectedMarketType,
  selectedConditionId,
  variant = 'default',
}: {
  card: SportsGamesCard
  selectedMarketType: SportsGamesMarketType
  selectedConditionId: string | null
  variant?: SportsGameGraphVariant
}) {
  const { width: windowWidth } = useWindowSize()
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const [activeTimeRange, setActiveTimeRange] = useState<(typeof TIME_RANGES)[number]>('1W')
  const [chartSettings, setChartSettings] = useState(() => ({ ...defaultChartSettings, bothOutcomes: false }))
  const [hasLoadedChartSettings, setHasLoadedChartSettings] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const isSecondaryMarketGraph = selectedMarketType === 'spread' || selectedMarketType === 'total'
  const isSportsEventHeroVariant = variant === 'sportsEventHero'
  const chartHeight = isSportsEventHeroVariant ? 332 : 300
  const chartMargin = isSportsEventHeroVariant
    ? { top: 12, right: 46, bottom: 40, left: 0 }
    : { top: 12, right: 30, bottom: 40, left: 0 }
  const heroLegendLabelWidth = 176
  const heroLegendLabelGap = 8
  const heroLegendRightInset = 4
  const heroLegendDomainRightTrim = 20
  const heroLegendRenderedWidth = Math.max(72, heroLegendLabelWidth - heroLegendDomainRightTrim)
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const [measuredChartWidth, setMeasuredChartWidth] = useState<number | null>(null)

  const fallbackChartWidth = useMemo(() => {
    const viewportWidth = windowWidth ?? 1200

    if (viewportWidth < 768) {
      return Math.max(260, viewportWidth - 112)
    }

    return Math.min(860, viewportWidth - 520)
  }, [windowWidth])
  const chartWidth = measuredChartWidth ?? fallbackChartWidth

  useEffect(() => {
    const element = chartContainerRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }
    const chartElement = element

    function updateWidth() {
      const nextWidth = Math.floor(chartElement.clientWidth)
      if (nextWidth > 0) {
        setMeasuredChartWidth(nextWidth)
      }
    }

    updateWidth()
    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(chartElement)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const stored = loadStoredChartSettings()
    setChartSettings({ ...stored, bothOutcomes: false })
    setHasLoadedChartSettings(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedChartSettings) {
      return
    }
    storeChartSettings({ ...chartSettings, bothOutcomes: false })
  }, [chartSettings, hasLoadedChartSettings])

  useEffect(() => {
    setCursorSnapshot(null)
  }, [activeTimeRange, selectedConditionId, selectedMarketType])

  const graphSeriesTargets = useMemo<SportsGraphSeriesTarget[]>(
    () => {
      if (
        selectedConditionId
        && isSecondaryMarketGraph
      ) {
        const selectedMarket = card.detailMarkets.find(
          market => market.condition_id === selectedConditionId,
        )
        if (selectedMarket) {
          const fallbackColors = ['var(--yes)', 'var(--no)']
          const orderedOutcomes = [...selectedMarket.outcomes]
            .sort((a, b) => a.outcome_index - b.outcome_index)

          const outcomeTargets = orderedOutcomes
            .map((outcome, index) => {
              const relatedButton = card.buttons.find(
                button => button.conditionId === selectedMarket.condition_id
                  && button.outcomeIndex === outcome.outcome_index,
              )
              const fallbackLabel = outcome.outcome_text?.trim() || `Option ${index + 1}`

              return {
                key: `${selectedMarket.condition_id}:${outcome.outcome_index}`,
                tokenId: outcome.token_id ?? null,
                market: selectedMarket,
                outcomeIndex: outcome.outcome_index,
                name: relatedButton?.label ?? fallbackLabel,
                color: resolveGraphSeriesColor(relatedButton, fallbackColors[index % fallbackColors.length]!),
              }
            })

          if (outcomeTargets.length > 0) {
            return outcomeTargets
          }
        }
      }

      const fallbackColors = ['var(--yes)', 'var(--primary)', 'var(--no)']

      const moneylineConditionIds = Array.from(new Set(
        card.buttons
          .filter(button => button.marketType === 'moneyline')
          .map(button => button.conditionId),
      ))

      const moneylineMarkets = moneylineConditionIds
        .map(conditionId => card.detailMarkets.find(market => market.condition_id === conditionId) ?? null)
        .filter((market): market is Market => Boolean(market))

      if (moneylineMarkets.length > 0) {
        return moneylineMarkets
          .slice(0, 3)
          .map<SportsGraphSeriesTarget | null>((market, index) => {
            const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
              ?? market.outcomes[0]
              ?? null
            if (!yesOutcome?.token_id) {
              return null
            }

            const relatedButton = card.buttons.find(
              button => button.conditionId === market.condition_id
                && button.outcomeIndex === yesOutcome.outcome_index,
            ) ?? card.buttons.find(button => button.conditionId === market.condition_id)

            return {
              key: market.condition_id,
              tokenId: yesOutcome.token_id,
              market,
              outcomeIndex: yesOutcome.outcome_index,
              name: resolveGraphSeriesName(card, relatedButton, market),
              color: resolveGraphSeriesColor(relatedButton, fallbackColors[index % fallbackColors.length]!),
            }
          })
          .filter((target): target is SportsGraphSeriesTarget => target !== null)
      }

      const seenConditionIds = new Set<string>()
      const fallbackTargets: SportsGraphSeriesTarget[] = []
      for (const market of card.detailMarkets) {
        if (seenConditionIds.has(market.condition_id)) {
          continue
        }
        seenConditionIds.add(market.condition_id)
        const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
          ?? market.outcomes[0]
          ?? null
        if (!yesOutcome?.token_id) {
          continue
        }

        const relatedButton = card.buttons.find(
          button => button.conditionId === market.condition_id
            && button.outcomeIndex === yesOutcome.outcome_index,
        ) ?? card.buttons.find(button => button.conditionId === market.condition_id)

        fallbackTargets.push({
          key: market.condition_id,
          tokenId: yesOutcome.token_id,
          market,
          outcomeIndex: yesOutcome.outcome_index,
          name: resolveGraphSeriesName(card, relatedButton, market),
          color: resolveGraphSeriesColor(relatedButton, fallbackColors[fallbackTargets.length % fallbackColors.length]!),
        })
      }

      return fallbackTargets.slice(0, 3)
    },
    [card, isSecondaryMarketGraph, selectedConditionId],
  )

  const marketTargets = useMemo(
    () => graphSeriesTargets
      .filter((target): target is SportsGraphSeriesTarget & { tokenId: string } => Boolean(target.tokenId))
      .map(target => ({
        conditionId: target.key,
        tokenId: target.tokenId,
      })),
    [graphSeriesTargets],
  )

  const { normalizedHistory } = useEventPriceHistory({
    eventId: card.id,
    range: activeTimeRange,
    targets: marketTargets,
    eventCreatedAt: card.eventCreatedAt,
    eventResolvedAt: card.eventResolvedAt,
  })

  const chartSeries = useMemo(() => {
    return graphSeriesTargets.map(target => ({
      key: target.key,
      name: target.name,
      color: target.color,
    }))
  }, [graphSeriesTargets])

  const historyChartData = useMemo<DataPoint[]>(() => {
    return normalizedHistory
      .map((point) => {
        const nextPoint: DataPoint = { date: point.date }
        let hasValue = false

        for (const series of chartSeries) {
          const value = point[series.key]
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            continue
          }

          nextPoint[series.key] = value
          hasValue = true
        }

        return hasValue ? nextPoint : null
      })
      .filter((point): point is DataPoint => point !== null)
  }, [chartSeries, normalizedHistory])

  const pairedHistoryChartData = useMemo<DataPoint[]>(() => {
    if (!isSecondaryMarketGraph || chartSeries.length !== 2) {
      return historyChartData
    }

    const [firstSeries, secondSeries] = chartSeries
    return historyChartData
      .map((point) => {
        const firstRaw = point[firstSeries.key]
        const secondRaw = point[secondSeries.key]
        const firstValue = typeof firstRaw === 'number' && Number.isFinite(firstRaw) ? firstRaw : null
        const secondValue = typeof secondRaw === 'number' && Number.isFinite(secondRaw) ? secondRaw : null

        if (firstValue === null && secondValue === null) {
          return null
        }

        const nextPoint: DataPoint = { ...point }
        if (firstValue !== null && secondValue === null) {
          nextPoint[secondSeries.key] = Math.max(0, Math.min(100, 100 - firstValue))
        }
        else if (firstValue === null && secondValue !== null) {
          nextPoint[firstSeries.key] = Math.max(0, Math.min(100, 100 - secondValue))
        }

        return nextPoint
      })
      .filter((point): point is DataPoint => point !== null)
  }, [chartSeries, historyChartData, isSecondaryMarketGraph])

  const fallbackChartData = useMemo<DataPoint[]>(() => {
    if (graphSeriesTargets.length === 0) {
      return []
    }

    const createdMs = Date.parse(card.eventCreatedAt)
    const resolvedMs = card.eventResolvedAt ? Date.parse(card.eventResolvedAt) : Number.NaN
    const anchorMs = Number.isFinite(resolvedMs)
      ? resolvedMs
      : (Number.isFinite(createdMs) ? createdMs : Date.parse('2020-01-01T00:00:00.000Z'))
    const endMs = anchorMs + 60_000
    const startMs = anchorMs - (30 * 60_000)

    const startPoint: DataPoint = { date: new Date(startMs) }
    const endPoint: DataPoint = { date: new Date(endMs) }

    for (const series of graphSeriesTargets) {
      const matchingOutcome = series.market.outcomes.find(
        outcome => outcome.outcome_index === series.outcomeIndex,
      )
      const cents = normalizeOutcomePriceCents(matchingOutcome, series.market)
      startPoint[series.key] = cents
      endPoint[series.key] = cents
    }

    return [startPoint, endPoint]
  }, [card.eventCreatedAt, card.eventResolvedAt, graphSeriesTargets])

  const chartData = pairedHistoryChartData.length > 0 ? pairedHistoryChartData : fallbackChartData

  const latestSnapshot = useMemo(() => {
    const nextValues: Record<string, number> = {}

    chartSeries.forEach((seriesItem) => {
      for (let index = chartData.length - 1; index >= 0; index -= 1) {
        const point = chartData[index]
        if (!point) {
          continue
        }

        const value = point[seriesItem.key]
        if (typeof value === 'number' && Number.isFinite(value)) {
          nextValues[seriesItem.key] = value
          break
        }
      }
    })

    return nextValues
  }, [chartData, chartSeries])

  const chartXDomain = useMemo(() => {
    if (!isSportsEventHeroVariant || chartData.length < 2) {
      return undefined
    }

    const firstTimestamp = chartData[0]?.date.getTime()
    const lastTimestamp = chartData[chartData.length - 1]?.date.getTime()
    if (!Number.isFinite(firstTimestamp) || !Number.isFinite(lastTimestamp) || lastTimestamp <= firstTimestamp) {
      return undefined
    }

    const dataSpanMs = Math.max(1, lastTimestamp - firstTimestamp)
    const plotWidthPx = Math.max(1, chartWidth - chartMargin.left - chartMargin.right)
    const reservedRightPx = Math.max(0, heroLegendRenderedWidth + heroLegendLabelGap + heroLegendRightInset)

    // Keep enough fixed room on the right for legend so the plotted line ends before chart edge.
    if (reservedRightPx >= plotWidthPx - 1) {
      return {
        start: firstTimestamp,
        end: lastTimestamp,
      }
    }

    const domainSpanMs = Math.round((dataSpanMs * plotWidthPx) / (plotWidthPx - reservedRightPx))
    return {
      start: firstTimestamp,
      end: firstTimestamp + domainSpanMs,
    }
  }, [
    chartData,
    chartMargin.left,
    chartMargin.right,
    chartWidth,
    heroLegendLabelGap,
    heroLegendRenderedWidth,
    heroLegendRightInset,
    isSportsEventHeroVariant,
  ])

  const heroLegendSeriesWithValues = useMemo(
    () => {
      if (!isSportsEventHeroVariant) {
        return []
      }

      return chartSeries
        .map((seriesItem) => {
          const hoveredValue = cursorSnapshot?.values?.[seriesItem.key]
          const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
            ? hoveredValue
            : latestSnapshot[seriesItem.key]
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return null
          }

          return { ...seriesItem, value }
        })
        .filter((entry): entry is { key: string, name: string, color: string, value: number } => entry !== null)
    },
    [chartSeries, cursorSnapshot, isSportsEventHeroVariant, latestSnapshot],
  )

  const heroLegendPositionedEntries = useMemo(
    () => {
      if (!isSportsEventHeroVariant || heroLegendSeriesWithValues.length === 0 || chartData.length === 0) {
        return [] as Array<{
          key: string
          name: string
          color: string
          value: number
          left: number
          top: number
          maxWidth: number
        }>
      }

      const firstTimestamp = chartData[0]?.date.getTime()
      const lastTimestamp = chartData[chartData.length - 1]?.date.getTime()
      if (!Number.isFinite(firstTimestamp) || !Number.isFinite(lastTimestamp)) {
        return []
      }

      const explicitStart = typeof chartXDomain?.start === 'number'
        ? chartXDomain.start
        : Number.NaN
      const explicitEnd = typeof chartXDomain?.end === 'number'
        ? chartXDomain.end
        : Number.NaN
      const domainStart = Number.isFinite(explicitStart) ? explicitStart : firstTimestamp
      const domainEndCandidate = Number.isFinite(explicitEnd) ? explicitEnd : lastTimestamp
      const domainEnd = Math.max(domainStart + 1, domainEndCandidate)
      const hoveredTimestampRaw = cursorSnapshot?.date.getTime() ?? lastTimestamp
      const hoveredTimestamp = Math.max(firstTimestamp, Math.min(lastTimestamp, hoveredTimestampRaw))

      const yBounds = calculateYAxisBounds(chartData, chartSeries)
      const ySpan = Math.max(1, yBounds.max - yBounds.min)
      const xSpan = Math.max(1, domainEnd - domainStart)
      const plotWidth = Math.max(1, chartWidth - chartMargin.left - chartMargin.right)
      const plotHeight = Math.max(1, chartHeight - chartMargin.top - chartMargin.bottom)
      const dotX = chartMargin.left + ((hoveredTimestamp - domainStart) / xSpan) * plotWidth
      const plotLeft = chartMargin.left
      const plotRight = chartWidth - chartMargin.right
      const availableFullWidth = plotRight - plotLeft - heroLegendRightInset
      const effectiveLabelWidth = Math.max(0, Math.min(heroLegendRenderedWidth, availableFullWidth))
      const maxLeft = plotRight - effectiveLabelWidth - heroLegendRightInset
      const labelLeft = Math.max(plotLeft, Math.min(maxLeft, dotX + heroLegendLabelGap))
      const labelHeight = 54
      const labelGap = 6
      const anchorOffset = labelHeight / 2
      const minTop = chartMargin.top
      const maxTop = chartMargin.top + plotHeight - labelHeight

      const preferredEntries = heroLegendSeriesWithValues.map((entry) => {
        const clampedValue = Math.max(yBounds.min, Math.min(yBounds.max, entry.value))
        const dotY = chartMargin.top + ((yBounds.max - clampedValue) / ySpan) * plotHeight
        const preferredTop = dotY - anchorOffset

        return {
          ...entry,
          dotY,
          left: labelLeft,
          maxWidth: effectiveLabelWidth,
          preferredTop: Math.max(minTop, Math.min(maxTop, preferredTop)),
        }
      })

      const sortedByPreferredTop = [...preferredEntries]
        .sort((left, right) => left.preferredTop - right.preferredTop)

      const stacked: Array<(typeof sortedByPreferredTop)[number] & { top: number }> = []
      sortedByPreferredTop.forEach((entry, index) => {
        const previousTop = index > 0 ? stacked[index - 1]!.top : null
        const top = previousTop == null
          ? entry.preferredTop
          : Math.max(entry.preferredTop, previousTop + labelHeight + labelGap)
        stacked.push({ ...entry, top: Math.max(minTop, Math.min(maxTop, top)) })
      })

      const last = stacked[stacked.length - 1]
      if (last && last.top > maxTop) {
        last.top = maxTop
        for (let index = stacked.length - 2; index >= 0; index -= 1) {
          const nextTop = stacked[index + 1]!.top
          stacked[index]!.top = Math.max(
            minTop,
            Math.min(stacked[index]!.preferredTop, nextTop - labelHeight - labelGap),
          )
        }
      }

      const topByKey = new Map(stacked.map(entry => [entry.key, entry.top] as const))
      return preferredEntries.map(entry => ({
        ...entry,
        top: topByKey.get(entry.key) ?? entry.preferredTop,
      }))
    },
    [
      chartData,
      chartHeight,
      heroLegendLabelGap,
      heroLegendRightInset,
      heroLegendRenderedWidth,
      chartMargin.bottom,
      chartMargin.left,
      chartMargin.right,
      chartMargin.top,
      chartSeries,
      chartWidth,
      chartXDomain?.end,
      chartXDomain?.start,
      cursorSnapshot?.date,
      heroLegendSeriesWithValues,
      isSportsEventHeroVariant,
    ],
  )

  const legendSeriesWithValues = useMemo(
    () => chartSeries
      .map((seriesItem) => {
        const hoveredValue = cursorSnapshot?.values?.[seriesItem.key]
        const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
          ? hoveredValue
          : latestSnapshot[seriesItem.key]

        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return null
        }

        return { ...seriesItem, value }
      })
      .filter((entry): entry is { key: string, name: string, color: string, value: number } => entry !== null),
    [chartSeries, cursorSnapshot, latestSnapshot],
  )

  const legendContent = !isSecondaryMarketGraph && !isSportsEventHeroVariant && legendSeriesWithValues.length > 0
    ? (
        <div className="flex min-h-5 flex-wrap items-center gap-4">
          {legendSeriesWithValues.map(entry => (
            <div key={entry.key} className="flex items-center gap-2">
              <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="inline-flex w-fit items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>{entry.name}</span>
                <span className={`
                  inline-flex min-w-8 shrink-0 items-baseline justify-end text-sm font-semibold text-foreground
                  tabular-nums
                `}
                >
                  {entry.value.toFixed(0)}
                  <span className="ml-0.5 text-sm text-foreground">%</span>
                </span>
              </span>
            </div>
          ))}
        </div>
      )
    : null

  if (graphSeriesTargets.length === 0) {
    return (
      <div className="rounded-lg border bg-secondary/30 px-3 py-6 text-sm text-muted-foreground">
        Graph is unavailable for this game.
      </div>
    )
  }

  return (
    <>
      <div style={isSportsEventHeroVariant ? { minHeight: `${chartHeight + 56}px` } : undefined}>
        <div ref={chartContainerRef} className="relative">
          <PredictionChart
            data={chartData}
            series={chartSeries}
            width={chartWidth}
            height={chartHeight}
            margin={chartMargin}
            xDomain={chartXDomain}
            dataSignature={`${card.id}:${chartSeries.map(series => series.key).join(',')}:${activeTimeRange}`}
            onCursorDataChange={setCursorSnapshot}
            xAxisTickCount={3}
            yAxis={undefined}
            legendContent={legendContent}
            showLegend={!isSecondaryMarketGraph && !isSportsEventHeroVariant}
            showTooltipSeriesLabels={!isSportsEventHeroVariant}
            disableCursorSplit={false}
            clampCursorToDataExtent={isSportsEventHeroVariant}
            markerOuterRadius={isSportsEventHeroVariant ? 0 : undefined}
            markerInnerRadius={isSportsEventHeroVariant ? 4 : undefined}
            lineCurve="monotoneX"
            tooltipValueFormatter={value => `${Math.round(value)}%`}
            autoscale={chartSettings.autoscale}
            showXAxis={chartSettings.xAxis}
            showYAxis={chartSettings.yAxis}
            showHorizontalGrid={chartSettings.horizontalGrid}
            showVerticalGrid={chartSettings.verticalGrid}
            showAnnotations={chartSettings.annotations}
          />

          {isSportsEventHeroVariant && heroLegendPositionedEntries.length > 0 && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {heroLegendPositionedEntries.map(entry => (
                <div
                  key={entry.key}
                  className="absolute"
                  style={{
                    top: `${entry.top}px`,
                    left: `${entry.left}px`,
                    width: `${entry.maxWidth}px`,
                  }}
                >
                  <p
                    className="truncate text-[13px] leading-snug font-medium tracking-tight"
                    style={{ color: entry.color }}
                  >
                    {entry.name}
                  </p>
                  <p
                    className="text-2xl/tight font-semibold tabular-nums"
                    style={{ color: entry.color }}
                  >
                    {`${Math.round(entry.value)}%`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-end pb-2">
          <EventChartControls
            timeRanges={TIME_RANGES}
            activeTimeRange={activeTimeRange}
            onTimeRangeChange={setActiveTimeRange}
            showOutcomeSwitch={false}
            oppositeOutcomeLabel=""
            onShuffle={() => {}}
            settings={chartSettings}
            onSettingsChange={setChartSettings}
            onExportData={() => setExportDialogOpen(true)}
            onEmbed={() => setEmbedDialogOpen(true)}
          />
        </div>
      </div>

      <EventChartExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        eventCreatedAt={card.eventCreatedAt}
        markets={card.detailMarkets}
        isMultiMarket={card.detailMarkets.length > 1}
      />
      <EventChartEmbedDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        markets={card.detailMarkets}
        initialMarketId={selectedConditionId}
      />
    </>
  )
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function abbreviatePositionMarketLabel(label: string, teams: SportsGamesCard['teams']) {
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

function resolveTradeHeaderTitle({
  card,
  selectedButton,
  marketType,
}: {
  card: SportsGamesCard
  selectedButton: SportsGamesButton
  marketType: SportsGamesMarketType
}) {
  if (marketType === 'btts') {
    return 'Both Teams to Score?'
  }

  if (marketType === 'total') {
    return 'Over vs Under'
  }

  if (selectedButton.tone === 'draw') {
    return 'DRAW'
  }

  const team1 = card.teams[0] ?? null
  const team2 = card.teams[1] ?? null
  const team1Label = resolveTeamShortLabel(team1?.name, team1?.abbreviation)
  const team2Label = resolveTeamShortLabel(team2?.name, team2?.abbreviation)

  if (team1Label && team2Label) {
    return `${team1Label} vs ${team2Label}`
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

function resolveTradeHeaderBadgeAccent(button: SportsGamesButton) {
  const normalizedTeamColor = normalizeHexColor(button.color)
  if (
    (button.tone === 'team1' || button.tone === 'team2')
    && normalizedTeamColor
  ) {
    const rgbComponents = resolveHexToRgbComponents(normalizedTeamColor)
    const readableTeamColor = ensureReadableTextColorOnDark(normalizedTeamColor)
    return {
      className: '',
      style: {
        color: readableTeamColor ?? normalizedTeamColor,
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

function resolveTeamByTone(card: SportsGamesCard, tone: SportsGamesButton['tone']) {
  if (tone === 'team1') {
    return card.teams[0] ?? null
  }
  if (tone === 'team2') {
    return card.teams[1] ?? null
  }
  return null
}

function resolveLeadingSpreadTeam(card: SportsGamesCard, button: SportsGamesButton) {
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

function TeamLogoBadge({
  card,
  button,
}: {
  card: SportsGamesCard
  button: SportsGamesButton
}) {
  const team = button.marketType === 'spread'
    ? resolveLeadingSpreadTeam(card, button)
    : resolveTeamByTone(card, button.tone)
  const fallbackInitial = team?.abbreviation?.slice(0, 1).toUpperCase()
    || team?.name?.slice(0, 1).toUpperCase()
    || '?'

  return (
    <div className="flex size-11 items-center justify-center">
      {team?.logoUrl
        ? (
            <Image
              src={team.logoUrl}
              alt={`${team.name} logo`}
              width={44}
              height={44}
              sizes="44px"
              className="h-[92%] w-[92%] object-contain object-center"
            />
          )
        : (
            <div className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
              {fallbackInitial}
            </div>
          )}
    </div>
  )
}

function DrawBadge() {
  return (
    <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-muted-foreground shadow-sm">
      <EqualIcon className="size-5.5" />
    </div>
  )
}

function TotalBadge({ button }: { button: SportsGamesButton }) {
  const isOverActive = button.tone === 'over'
  const isUnderActive = button.tone === 'under'

  return (
    <div
      className={`
        relative inline-flex size-11 items-center justify-center overflow-hidden rounded-lg text-white shadow-sm
      `}
    >
      <span
        className={cn(
          'absolute inset-0 bg-yes transition-opacity [clip-path:polygon(0_0,100%_0,0_100%)]',
          !isOverActive && 'opacity-25',
        )}
      />
      <span
        className={cn(
          'absolute inset-0 bg-no transition-opacity [clip-path:polygon(100%_0,100%_100%,0_100%)]',
          !isUnderActive && 'opacity-25',
        )}
      />
      <span className={cn(
        'absolute top-2 left-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isOverActive && 'opacity-35',
      )}
      >
        O
      </span>
      <span className={cn(
        'absolute right-2 bottom-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isUnderActive && 'opacity-35',
      )}
      >
        U
      </span>
    </div>
  )
}

function BttsBadge({ button }: { button: SportsGamesButton }) {
  const isYesActive = button.tone !== 'under'
  const isNoActive = button.tone === 'under'

  return (
    <div
      className={`
        relative inline-flex size-11 items-center justify-center overflow-hidden rounded-lg text-white shadow-sm
      `}
    >
      <span
        className={cn(
          'absolute inset-0 bg-yes transition-opacity [clip-path:polygon(0_0,100%_0,0_100%)]',
          !isYesActive && 'opacity-25',
        )}
      />
      <span
        className={cn(
          'absolute inset-0 bg-no transition-opacity [clip-path:polygon(100%_0,100%_100%,0_100%)]',
          !isNoActive && 'opacity-25',
        )}
      />
      <span className={cn(
        'absolute top-2 left-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isYesActive && 'opacity-35',
      )}
      >
        Y
      </span>
      <span className={cn(
        'absolute right-2 bottom-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isNoActive && 'opacity-35',
      )}
      >
        N
      </span>
    </div>
  )
}

export function SportsOrderPanelMarketInfo({
  card,
  selectedButton,
  selectedOutcome,
  marketType,
}: {
  card: SportsGamesCard
  selectedButton: SportsGamesButton
  selectedOutcome: Outcome | null
  marketType: SportsGamesMarketType
}) {
  const badgeLabel = resolveSelectedTradeLabel(selectedButton, selectedOutcome)
  const headerTitle = resolveTradeHeaderTitle({
    card,
    selectedButton,
    marketType,
  })
  const badgeAccent = resolveTradeHeaderBadgeAccent(selectedButton)
  const marketIcon = marketType === 'total'
    ? <TotalBadge button={selectedButton} />
    : marketType === 'btts'
      ? <BttsBadge button={selectedButton} />
      : selectedButton.tone === 'draw'
        ? <DrawBadge />
        : <TeamLogoBadge card={card} button={selectedButton} />

  return (
    <div className="mb-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {marketIcon}
        </div>

        <div className="min-w-0">
          <p className="line-clamp-2 text-base/tight font-bold text-foreground">
            {headerTitle}
          </p>
          <span
            className={cn(
              'mt-1.5 inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-semibold',
              badgeAccent.className,
            )}
            style={badgeAccent.style}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

interface SportsGameDetailsPanelProps {
  card: SportsGamesCard
  activeDetailsTab: DetailsTab
  selectedButtonKey: string | null
  showBottomContent: boolean
  allowedConditionIds?: Set<string> | null
  positionsTitle?: string
  oddsFormat?: OddsFormat
  onChangeTab: (tab: DetailsTab) => void
  onSelectButton: (
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) => void
}

export function SportsGameDetailsPanel({
  card,
  activeDetailsTab,
  selectedButtonKey,
  showBottomContent,
  allowedConditionIds = null,
  positionsTitle,
  oddsFormat = 'price',
  onChangeTab,
  onSelectButton,
}: SportsGameDetailsPanelProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const user = useUser()
  const linePickerScrollerRef = useRef<HTMLDivElement | null>(null)
  const linePickerButtonsRef = useRef<Record<string, HTMLButtonElement | null>>({})
  const [linePickerStartSpacer, setLinePickerStartSpacer] = useState(0)
  const [linePickerEndSpacer, setLinePickerEndSpacer] = useState(0)
  const [cashOutPayload, setCashOutPayload] = useState<SportsCashOutModalPayload | null>(null)
  const [isPositionsExpanded, setIsPositionsExpanded] = useState(false)
  const [convertTagKey, setConvertTagKey] = useState<string | null>(null)
  const orderMarketConditionId = useOrder(state => state.market?.condition_id ?? null)
  const orderOutcomeIndex = useOrder(state => state.outcome?.outcome_index ?? null)
  const setOrderOutcome = useOrder(state => state.setOutcome)
  const setOrderMarket = useOrder(state => state.setMarket)
  const setOrderType = useOrder(state => state.setType)
  const setOrderSide = useOrder(state => state.setSide)
  const setOrderAmount = useOrder(state => state.setAmount)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)

  const ownerAddress = useMemo(() => {
    if (user?.proxy_wallet_address && user.proxy_wallet_status === 'deployed') {
      return user.proxy_wallet_address
    }
    return null
  }, [user?.proxy_wallet_address, user?.proxy_wallet_status])

  const cardMarketByConditionId = useMemo(
    () => new Map(card.detailMarkets.map(market => [market.condition_id, market] as const)),
    [card.detailMarkets],
  )

  const cardButtonsByConditionAndOutcome = useMemo(() => {
    const map = new Map<string, SportsGamesButton>()
    card.buttons.forEach((button) => {
      map.set(`${button.conditionId}:${button.outcomeIndex}`, button)
    })
    return map
  }, [card.buttons])

  const cardFirstButtonByCondition = useMemo(() => {
    const map = new Map<string, SportsGamesButton>()
    card.buttons.forEach((button) => {
      if (!map.has(button.conditionId)) {
        map.set(button.conditionId, button)
      }
    })
    return map
  }, [card.buttons])

  const moneylineConditionIds = useMemo(
    () => new Set(
      card.buttons
        .filter(button => button.marketType === 'moneyline')
        .map(button => button.conditionId),
    ),
    [card.buttons],
  )

  const { data: userPositions } = useQuery<UserPosition[]>({
    queryKey: ['sports-card-user-positions', ownerAddress, card.id],
    enabled: Boolean(ownerAddress),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchInterval: ownerAddress ? (showBottomContent ? 15_000 : false) : false,
    refetchIntervalInBackground: showBottomContent,
    queryFn: ({ signal }) => fetchUserPositionsForMarket({
      pageParam: 0,
      userAddress: ownerAddress!,
      status: 'active',
      signal,
    }),
  })

  const positionTags = useMemo<SportsPositionTag[]>(() => {
    if (!ownerAddress || !userPositions?.length) {
      return []
    }

    const aggregated = new Map<string, {
      conditionId: string
      outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
      market: Market
      outcome: Outcome
      button: SportsGamesButton | null
      marketTypeLabel: 'Moneyline' | 'Spread' | 'Total' | 'Both Teams to Score'
      marketLabel: string
      outcomeLabel: string
      shares: number
      totalCost: number | null
      currentValue: number
      latestActivityAtMs: number
    }>()

    userPositions.forEach((position) => {
      const conditionId = position.market?.condition_id
      if (!conditionId) {
        return
      }

      if (allowedConditionIds && !allowedConditionIds.has(conditionId)) {
        return
      }

      const market = cardMarketByConditionId.get(conditionId)
      if (!market) {
        return
      }

      const shares = resolvePositionShares(position)
      if (!(shares > 0)) {
        return
      }

      const explicitOutcomeIndex = typeof position.outcome_index === 'number'
        ? position.outcome_index
        : undefined
      const normalizedOutcomeText = position.outcome_text?.trim().toLowerCase()
      const resolvedOutcomeIndex = explicitOutcomeIndex != null
        ? explicitOutcomeIndex
        : normalizedOutcomeText === 'no'
          ? OUTCOME_INDEX.NO
          : OUTCOME_INDEX.YES

      if (resolvedOutcomeIndex !== OUTCOME_INDEX.YES && resolvedOutcomeIndex !== OUTCOME_INDEX.NO) {
        return
      }

      const outcome = market.outcomes.find(item => item.outcome_index === resolvedOutcomeIndex)
      if (!outcome) {
        return
      }

      const button = cardButtonsByConditionAndOutcome.get(`${conditionId}:${resolvedOutcomeIndex}`)
        ?? cardFirstButtonByCondition.get(conditionId)
        ?? null
      const fallbackMarketLabel = market.sports_group_item_title?.trim()
        || market.short_title?.trim()
        || market.title
      const rawMarketLabel = button?.label?.trim()
        || outcome.outcome_text?.trim()
        || fallbackMarketLabel
      const marketLabel = abbreviatePositionMarketLabel(rawMarketLabel, card.teams)
        || abbreviatePositionMarketLabel(fallbackMarketLabel, card.teams)
      const outcomeLabel = resolvedOutcomeIndex === OUTCOME_INDEX.NO ? 'NO' : 'YES'
      const avgPrice = toFiniteNumber(position.avgPrice)
        ?? Number(fromMicro(String(position.average_position ?? 0), 6))
      const normalizedAvgPrice = Number.isFinite(avgPrice) ? avgPrice : null
      const costValue = resolvePositionCostValue(position, shares, normalizedAvgPrice)
      const currentValue = resolvePositionCurrentValue(position, shares, normalizedAvgPrice)
      const activityMs = Date.parse(position.last_activity_at)
      const normalizedActivityMs = Number.isFinite(activityMs) ? activityMs : 0
      const key = `${conditionId}:${resolvedOutcomeIndex}`
      const existing = aggregated.get(key)

      if (!existing) {
        aggregated.set(key, {
          conditionId,
          outcomeIndex: resolvedOutcomeIndex,
          market,
          outcome,
          button,
          marketTypeLabel: resolveMarketTypeLabel(button, market),
          marketLabel,
          outcomeLabel,
          shares,
          totalCost: typeof costValue === 'number' ? costValue : null,
          currentValue,
          latestActivityAtMs: normalizedActivityMs,
        })
        return
      }

      existing.shares += shares
      existing.currentValue += currentValue
      existing.latestActivityAtMs = Math.max(existing.latestActivityAtMs, normalizedActivityMs)
      if (typeof costValue === 'number') {
        existing.totalCost = (existing.totalCost ?? 0) + costValue
      }
    })

    return Array.from(aggregated.values())
      .map((item) => {
        const avgPriceCents = item.shares > 0 && typeof item.totalCost === 'number'
          ? (item.totalCost / item.shares) * 100
          : null
        const summaryLabel = item.marketTypeLabel === 'Moneyline'
          ? `${item.marketLabel} ${item.outcomeLabel}`.trim()
          : item.marketLabel.trim()

        return {
          key: `${item.conditionId}:${item.outcomeIndex}`,
          conditionId: item.conditionId,
          outcomeIndex: item.outcomeIndex,
          marketTypeLabel: item.marketTypeLabel,
          marketLabel: item.marketLabel,
          outcomeLabel: item.outcomeLabel,
          summaryLabel,
          shares: item.shares,
          avgPriceCents,
          totalCost: item.totalCost,
          currentValue: item.currentValue,
          market: item.market,
          outcome: item.outcome,
          button: item.button,
          latestActivityAtMs: item.latestActivityAtMs,
        }
      })
      .sort((a, b) => b.latestActivityAtMs - a.latestActivityAtMs)
  }, [
    allowedConditionIds,
    card.teams,
    cardButtonsByConditionAndOutcome,
    cardFirstButtonByCondition,
    cardMarketByConditionId,
    ownerAddress,
    userPositions,
  ])

  const visiblePositionTags = useMemo(
    () => positionTags.slice(0, 3),
    [positionTags],
  )

  const hiddenPositionTagsCount = useMemo(
    () => Math.max(0, positionTags.length - visiblePositionTags.length),
    [positionTags.length, visiblePositionTags.length],
  )

  const isNegRiskEnabled = useMemo(() => {
    return Boolean(
      card.event.neg_risk
      || card.event.neg_risk_augmented
      || card.event.neg_risk_market_id
      || card.detailMarkets.some(market => market.neg_risk || market.neg_risk_market_id),
    )
  }, [card.detailMarkets, card.event.neg_risk, card.event.neg_risk_augmented, card.event.neg_risk_market_id])

  const convertDialogTag = useMemo(
    () => (convertTagKey ? positionTags.find(tag => tag.key === convertTagKey) ?? null : null),
    [convertTagKey, positionTags],
  )

  const convertDialogOptions = useMemo(() => {
    if (!convertDialogTag) {
      return []
    }

    return [{
      id: convertDialogTag.key,
      conditionId: convertDialogTag.conditionId,
      label: convertDialogTag.market.short_title || convertDialogTag.market.title,
      shares: convertDialogTag.shares,
    }]
  }, [convertDialogTag])

  const convertDialogOutcomes = useMemo(() => {
    const seenConditionIds = new Set<string>()
    return card.detailMarkets
      .filter((market) => {
        if (!market.condition_id || seenConditionIds.has(market.condition_id)) {
          return false
        }
        if (allowedConditionIds && !allowedConditionIds.has(market.condition_id)) {
          return false
        }
        seenConditionIds.add(market.condition_id)
        return true
      })
      .map(market => ({
        conditionId: market.condition_id,
        questionId: market.question_id,
        label: market.short_title || market.title,
        iconUrl: market.icon_url,
      }))
  }, [allowedConditionIds, card.detailMarkets])

  useEffect(() => {
    if (convertTagKey && !positionTags.some(tag => tag.key === convertTagKey)) {
      setConvertTagKey(null)
    }
  }, [convertTagKey, positionTags])

  const selectedButton = useMemo(
    () => resolveSelectedButton(card, selectedButtonKey),
    [card, selectedButtonKey],
  )

  const selectedMarket = useMemo(
    () => resolveSelectedMarket(card, selectedButtonKey),
    [card, selectedButtonKey],
  )

  const selectedOutcome = useMemo(() => {
    if (!selectedMarket) {
      return null
    }

    if (
      orderMarketConditionId === selectedMarket.condition_id
      && (orderOutcomeIndex === OUTCOME_INDEX.YES || orderOutcomeIndex === OUTCOME_INDEX.NO)
    ) {
      const syncedOutcome = selectedMarket.outcomes.find(
        outcome => outcome.outcome_index === orderOutcomeIndex,
      )
      if (syncedOutcome) {
        return syncedOutcome
      }
    }

    return resolveSelectedOutcome(selectedMarket, selectedButton)
  }, [orderMarketConditionId, orderOutcomeIndex, selectedButton, selectedMarket])

  const selectedLinePickerMarketType = useMemo<LinePickerMarketType | null>(() => {
    if (!selectedButton) {
      return null
    }
    return (selectedButton.marketType === 'spread' || selectedButton.marketType === 'total')
      ? selectedButton.marketType
      : null
  }, [selectedButton])

  const linePickerOptions = useMemo(
    () => (selectedLinePickerMarketType ? buildLinePickerOptions(card, selectedLinePickerMarketType) : []),
    [card, selectedLinePickerMarketType],
  )

  const activeLineOptionIndex = useMemo(() => {
    if (!selectedButton || linePickerOptions.length === 0) {
      return -1
    }

    return linePickerOptions.findIndex(option => option.conditionId === selectedButton.conditionId)
  }, [linePickerOptions, selectedButton])

  const hasLinePicker = selectedLinePickerMarketType !== null && linePickerOptions.length > 0

  const nextOutcome = useMemo(() => {
    if (!selectedMarket || !selectedOutcome) {
      return null
    }

    return selectedMarket.outcomes.find(
      outcome => outcome.outcome_index !== selectedOutcome.outcome_index,
    ) ?? null
  }, [selectedMarket, selectedOutcome])

  const tradeSelectionLabel = useMemo(
    () => resolveSelectedTradeLabel(selectedButton, selectedOutcome),
    [selectedButton, selectedOutcome],
  )

  const switchTooltip = useMemo(() => {
    return resolveSwitchTooltip(selectedMarket, nextOutcome)
  }, [nextOutcome, selectedMarket])

  const handleToggleOutcome = useCallback(() => {
    if (!nextOutcome) {
      return
    }

    setOrderOutcome(nextOutcome)
  }, [nextOutcome, setOrderOutcome])

  const handleCashOutTag = useCallback(async (
    tag: SportsPositionTag,
    event?: ReactMouseEventType<HTMLElement>,
  ) => {
    event?.stopPropagation()

    const tokenId = tag.outcome.token_id ? String(tag.outcome.token_id) : null
    if (!tokenId) {
      return
    }

    let summary = await fetchOrderBookSummaries([tokenId])
      .then(result => result[tokenId])
      .catch(() => null)

    if (!summary) {
      summary = null
    }

    const bids = normalizeBookLevels(summary?.bids, 'bid')
    const asks = normalizeBookLevels(summary?.asks, 'ask')
    const fill = calculateMarketFill(ORDER_SIDE.SELL, tag.shares, bids, asks)

    setOrderType(ORDER_TYPE.MARKET)
    setOrderSide(ORDER_SIDE.SELL)
    setOrderMarket(tag.market)
    setOrderOutcome(tag.outcome)
    setOrderAmount(formatAmountInputValue(tag.shares, { roundingMode: 'floor' }))

    if (isMobile) {
      setIsMobileOrderPanelOpen(true)
    }

    setCashOutPayload({
      outcomeLabel: tag.summaryLabel,
      outcomeShortLabel: card.event.title || tag.market.short_title || tag.market.title,
      outcomeIconUrl: tag.market.icon_url,
      shares: tag.shares,
      filledShares: fill.filledShares,
      avgPriceCents: fill.avgPriceCents,
      receiveAmount: fill.totalCost > 0 ? fill.totalCost : null,
      sellBids: bids,
    })
  }, [
    card.event.title,
    isMobile,
    setIsMobileOrderPanelOpen,
    setOrderAmount,
    setOrderMarket,
    setOrderOutcome,
    setOrderSide,
    setOrderType,
  ])

  const handleOpenConvert = useCallback((
    tag: SportsPositionTag,
    event?: ReactMouseEventType<HTMLElement>,
  ) => {
    event?.stopPropagation()
    if (
      !isNegRiskEnabled
      || !moneylineConditionIds.has(tag.conditionId)
      || tag.outcomeIndex !== OUTCOME_INDEX.NO
      || tag.outcome.outcome_index !== OUTCOME_INDEX.NO
      || tag.shares <= 0
    ) {
      return
    }
    setConvertTagKey(tag.key)
  }, [isNegRiskEnabled, moneylineConditionIds])

  const handleCashOutModalChange = useCallback((open: boolean) => {
    if (!open) {
      setCashOutPayload(null)
    }
  }, [])

  const handleCashOutSubmit = useCallback((sharesToSell: number) => {
    if (!(sharesToSell > 0)) {
      return
    }
    setOrderAmount(formatAmountInputValue(sharesToSell, { roundingMode: 'floor' }))
    setCashOutPayload(null)
    const form = document.getElementById('event-order-form') as HTMLFormElement | null
    form?.requestSubmit()
  }, [setOrderAmount])

  const pickLineOption = useCallback((optionIndex: number) => {
    if (!selectedButton) {
      return
    }

    const option = linePickerOptions[optionIndex]
    if (!option) {
      return
    }

    const preferredButton = option.buttons.find(button => button.outcomeIndex === selectedButton.outcomeIndex)
      ?? option.buttons[0]
    if (!preferredButton) {
      return
    }

    onSelectButton(preferredButton.key, { panelMode: 'preserve' })
  }, [linePickerOptions, onSelectButton, selectedButton])

  const handlePickPreviousLine = useCallback(() => {
    if (activeLineOptionIndex <= 0) {
      return
    }
    pickLineOption(activeLineOptionIndex - 1)
  }, [activeLineOptionIndex, pickLineOption])

  const handlePickNextLine = useCallback(() => {
    if (activeLineOptionIndex < 0 || activeLineOptionIndex >= linePickerOptions.length - 1) {
      return
    }
    pickLineOption(activeLineOptionIndex + 1)
  }, [activeLineOptionIndex, linePickerOptions.length, pickLineOption])

  const alignActiveLineOption = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (activeLineOptionIndex < 0) {
      return
    }

    const activeOption = linePickerOptions[activeLineOptionIndex]
    if (!activeOption) {
      return
    }

    const scroller = linePickerScrollerRef.current
    const activeButton = linePickerButtonsRef.current[activeOption.conditionId]
    if (!scroller || !activeButton) {
      return
    }

    const targetLeft = activeButton.offsetLeft - (scroller.clientWidth - activeButton.offsetWidth) / 2
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
    const clampedLeft = Math.max(0, Math.min(targetLeft, maxLeft))

    scroller.scrollTo({
      left: clampedLeft,
      top: scroller.scrollTop,
      behavior,
    })
  }, [activeLineOptionIndex, linePickerOptions])

  const updateLinePickerSpacers = useCallback(() => {
    const scroller = linePickerScrollerRef.current
    if (!scroller || linePickerOptions.length === 0) {
      setLinePickerStartSpacer(0)
      setLinePickerEndSpacer(0)
      return
    }

    const firstOptionId = linePickerOptions[0]?.conditionId
    const lastOptionId = linePickerOptions[linePickerOptions.length - 1]?.conditionId
    const firstButton = firstOptionId ? linePickerButtonsRef.current[firstOptionId] : null
    const lastButton = lastOptionId ? linePickerButtonsRef.current[lastOptionId] : null

    const viewportWidth = scroller.clientWidth
    const startSpacerWidth = Math.max(0, viewportWidth / 2 - (firstButton?.offsetWidth ?? 0) / 2)
    const endSpacerWidth = Math.max(0, viewportWidth / 2 - (lastButton?.offsetWidth ?? 0) / 2)

    setLinePickerStartSpacer(startSpacerWidth)
    setLinePickerEndSpacer(endSpacerWidth)
  }, [linePickerOptions])

  useEffect(() => {
    if (activeLineOptionIndex < 0) {
      return
    }
    alignActiveLineOption('auto')
  }, [activeLineOptionIndex, alignActiveLineOption, linePickerStartSpacer, linePickerEndSpacer])

  useEffect(() => {
    if (!hasLinePicker) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      updateLinePickerSpacers()
      alignActiveLineOption('auto')
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [alignActiveLineOption, hasLinePicker, updateLinePickerSpacers])

  useEffect(() => {
    const scrollerElement = linePickerScrollerRef.current
    if (!hasLinePicker || !scrollerElement) {
      return
    }

    updateLinePickerSpacers()
    const observer = new ResizeObserver(() => {
      updateLinePickerSpacers()
    })
    observer.observe(scrollerElement)
    return () => {
      observer.disconnect()
    }
  }, [hasLinePicker, updateLinePickerSpacers])

  const selectedMarketTokenIds = useMemo(() => {
    if (!selectedMarket) {
      return []
    }

    return selectedMarket.outcomes
      .map(outcome => outcome.token_id)
      .filter((tokenId): tokenId is string => Boolean(tokenId))
  }, [selectedMarket])

  const {
    data: orderBookSummaries,
    isLoading: isOrderBookLoading,
    isRefetching: isOrderBookRefetching,
    refetch: refetchOrderBook,
  } = useOrderBookSummaries(selectedMarketTokenIds, {
    enabled: showBottomContent && activeDetailsTab === 'orderBook' && selectedMarketTokenIds.length > 0,
  })

  const isStandalonePositionsCard = Boolean(positionsTitle)
  const shouldShowPortfolio = visiblePositionTags.length > 0
  const showPositionTagSummary = !isStandalonePositionsCard
  const formatPositionOddsLabel = useCallback((cents: number | null) => {
    if (oddsFormat === 'price') {
      return formatCompactCentsLabel(cents)
    }
    return formatOddsFromCents(cents, oddsFormat)
  }, [oddsFormat])
  const formatAverageCellLabel = useCallback((cents: number | null) => {
    if (oddsFormat === 'price') {
      return formatCentsLabel(cents, { fallback: '—' })
    }
    return formatOddsFromCents(cents, oddsFormat)
  }, [oddsFormat])

  if (!showBottomContent && !hasLinePicker && !shouldShowPortfolio) {
    return null
  }

  return (
    <>
      <div
        className={cn(
          'overflow-hidden transition-[max-height,opacity,margin] duration-200',
          hasLinePicker
            ? (showBottomContent ? '-mt-3 mb-3 max-h-32 opacity-100' : '-mt-3 mb-0 max-h-32 opacity-100')
            : 'mb-0 max-h-0 opacity-0',
        )}
      >
        {hasLinePicker && (
          <div className={cn(
            '-mx-2.5 bg-card px-2.5',
            !showBottomContent && 'border-t',
            showBottomContent ? 'pb-0' : 'pb-2',
          )}
          >
            <div className="relative pt-2">
              <span
                aria-hidden
                className="
                  absolute top-0 left-1/2 h-2 w-3 -translate-x-1/2 bg-primary [clip-path:polygon(50%_100%,0_0,100%_0)]
                "
              />

              <div className="mt-0.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePickPreviousLine}
                  disabled={activeLineOptionIndex <= 0}
                  className={cn(
                    `
                      inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                      focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
                    `,
                    activeLineOptionIndex > 0
                      ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                      : 'cursor-not-allowed opacity-40',
                  )}
                  aria-label="Previous line"
                >
                  <ChevronLeftIcon className="size-4.5" />
                </button>

                <div
                  ref={linePickerScrollerRef}
                  className={`
                    flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none]
                    [&::-webkit-scrollbar]:hidden
                  `}
                >
                  <span aria-hidden className="shrink-0" style={{ width: linePickerStartSpacer }} />
                  {linePickerOptions.map((option, index) => (
                    <button
                      key={`${card.id}-${option.conditionId}`}
                      type="button"
                      onClick={() => pickLineOption(index)}
                      ref={(node) => {
                        linePickerButtonsRef.current[option.conditionId] = node
                      }}
                      className={cn(
                        'w-10 shrink-0 text-center text-sm font-medium text-muted-foreground transition-colors',
                        index === activeLineOptionIndex
                          ? 'text-base font-semibold text-foreground'
                          : 'hover:text-foreground/80',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                  <span aria-hidden className="shrink-0" style={{ width: linePickerEndSpacer }} />
                </div>

                <button
                  type="button"
                  onClick={handlePickNextLine}
                  disabled={activeLineOptionIndex < 0 || activeLineOptionIndex >= linePickerOptions.length - 1}
                  className={cn(
                    `
                      inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                      focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
                    `,
                    activeLineOptionIndex >= 0 && activeLineOptionIndex < linePickerOptions.length - 1
                      ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                      : 'cursor-not-allowed opacity-40',
                  )}
                  aria-label="Next line"
                >
                  <ChevronRightIcon className="size-4.5" />
                </button>
              </div>
            </div>

            {showBottomContent && (
              <div className="-mx-2.5 mt-2 border-t" />
            )}
          </div>
        )}
      </div>

      {showBottomContent && (
        <>
          <div className="-mx-2.5 mb-3 border-b bg-card">
            <div className="flex w-full items-center gap-2 px-2.5">
              <div className="flex w-0 flex-1 items-center gap-4 overflow-x-auto">
                {([
                  { id: 'orderBook', label: 'Order Book' },
                  { id: 'graph', label: 'Graph' },
                ] as const).map(tab => (
                  <button
                    key={`${card.id}-${tab.id}`}
                    type="button"
                    onClick={() => onChangeTab(tab.id)}
                    className={cn(
                      `
                        border-b-2 border-transparent pt-1 pb-2 text-sm font-semibold whitespace-nowrap
                        transition-colors
                      `,
                      activeDetailsTab === tab.id
                        ? 'border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {selectedMarketTokenIds.length > 0 && (
                <button
                  type="button"
                  className={cn(
                    `
                      -mt-1 ml-auto inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground
                      transition-colors
                    `,
                    'hover:bg-muted/70 hover:text-foreground',
                    'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                  )}
                  aria-label="Refresh order book"
                  title="Refresh order book"
                  onClick={() => { void refetchOrderBook() }}
                  disabled={isOrderBookLoading || isOrderBookRefetching}
                >
                  <RefreshCwIcon
                    className={cn(
                      'size-3',
                      { 'animate-spin': isOrderBookLoading || isOrderBookRefetching },
                    )}
                  />
                </button>
              )}
            </div>
          </div>

          {activeDetailsTab === 'orderBook'
            ? (
                (selectedMarket && selectedOutcome)
                  ? (
                      <div className={cn('-mx-2.5', visiblePositionTags.length === 0 && '-mb-2.5')}>
                        <EventOrderBook
                          market={selectedMarket}
                          outcome={selectedOutcome}
                          summaries={orderBookSummaries}
                          isLoadingSummaries={isOrderBookLoading && !orderBookSummaries}
                          eventSlug={card.slug}
                          surfaceVariant="sportsCard"
                          oddsFormat={oddsFormat}
                          tradeLabel={`TRADE ${tradeSelectionLabel}`}
                          onToggleOutcome={nextOutcome ? handleToggleOutcome : undefined}
                          toggleOutcomeTooltip={switchTooltip ?? undefined}
                        />
                      </div>
                    )
                  : (
                      <div className="rounded-lg border bg-card px-3 py-6 text-sm text-muted-foreground">
                        Order book is unavailable for this game.
                      </div>
                    )
              )
            : (
                <SportsGameGraph
                  card={card}
                  selectedMarketType={selectedButton?.marketType ?? 'moneyline'}
                  selectedConditionId={selectedButton?.conditionId ?? null}
                  variant={
                    selectedButton?.marketType === 'spread' || selectedButton?.marketType === 'total'
                      ? 'sportsEventHero'
                      : 'default'
                  }
                />
              )}
        </>
      )}

      {shouldShowPortfolio && (
        <div className={cn(
          '-mx-2.5 bg-card',
          isStandalonePositionsCard && 'overflow-hidden rounded-[inherit]',
        )}
        >
          <div className={cn(!isStandalonePositionsCard && 'border-t')}>
            <div
              role="button"
              tabIndex={0}
              data-sports-card-control="true"
              onClick={(event) => {
                event.stopPropagation()
                setIsPositionsExpanded(current => !current)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                event.preventDefault()
                event.stopPropagation()
                setIsPositionsExpanded(current => !current)
              }}
              className={cn(
                'flex w-full items-center bg-card text-muted-foreground transition-colors hover:bg-secondary',
                isStandalonePositionsCard
                  ? 'min-h-16 gap-3 px-4 py-3 text-sm'
                  : 'min-h-11 gap-2 px-2.5 py-2 text-xs sm:px-2.5',
              )}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center text-foreground',
                  isStandalonePositionsCard ? 'gap-2 text-sm font-semibold' : 'gap-1 text-sm font-semibold',
                )}
              >
                <span>{positionsTitle ?? t('Positions')}</span>
                <ChevronDownIcon
                  className={cn(
                    'transition-transform',
                    isStandalonePositionsCard ? 'size-4' : 'size-3.5',
                    isPositionsExpanded ? 'rotate-180' : 'rotate-0',
                  )}
                />
              </div>

              {showPositionTagSummary && (
                <>
                  <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden">
                    {visiblePositionTags.map((tag) => {
                      const tagAccent = tag.button
                        ? resolveTradeHeaderBadgeAccent(tag.button)
                        : (tag.outcomeIndex === OUTCOME_INDEX.NO
                            ? { className: 'bg-no/10 text-no', style: undefined }
                            : { className: 'bg-yes/10 text-yes', style: undefined })

                      return (
                        <span
                          key={tag.key}
                          className={cn(
                            `
                              group/position inline-flex max-w-44 min-w-0 items-center rounded-sm px-2.5 py-1 text-xs
                              font-semibold
                            `,
                            tagAccent.className,
                          )}
                          style={tagAccent.style}
                        >
                          <span className="truncate whitespace-nowrap">
                            {`${tag.summaryLabel} | ${formatSharesLabel(tag.shares)} @ ${formatPositionOddsLabel(tag.avgPriceCents)}`}
                          </span>
                          <button
                            type="button"
                            data-sports-card-control="true"
                            className={cn(
                              'ml-1 inline-flex w-0 items-center justify-center overflow-hidden opacity-0',
                              'transition-all duration-150 group-hover/position:w-3 group-hover/position:opacity-100',
                              'pointer-events-none group-hover/position:pointer-events-auto',
                            )}
                            aria-label={`Cash out ${tag.summaryLabel}`}
                            onClick={event => void handleCashOutTag(tag, event)}
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>

                  {hiddenPositionTagsCount > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {`+${hiddenPositionTagsCount} more`}
                    </span>
                  )}
                </>
              )}
            </div>

            {isPositionsExpanded && (
              <div className="border-t bg-card px-2.5 py-2 sm:px-2.5" data-sports-card-control="true">
                <div className="w-full overflow-x-auto" onClick={event => event.stopPropagation()}>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <th className="py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Outcome</th>
                        <th className="px-2 py-2 text-right">Avg</th>
                        <th className="px-2 py-2 text-right">Cost</th>
                        <th className="px-2 py-2 text-right">To Win</th>
                        <th className="px-2 py-2 text-right">Current</th>
                        <th className="py-2 text-right" />
                      </tr>
                      <tr>
                        <th colSpan={7} className="p-0">
                          <div className="border-t" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {positionTags.map((tag) => {
                        const tagAccent = tag.button
                          ? resolveTradeHeaderBadgeAccent(tag.button)
                          : (tag.outcomeIndex === OUTCOME_INDEX.NO
                              ? { className: 'bg-no/10 text-no', style: undefined }
                              : { className: 'bg-yes/10 text-yes', style: undefined })
                        const costLabel = typeof tag.totalCost === 'number'
                          ? formatCurrency(tag.totalCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'
                        const toWinLabel = formatCurrency(tag.shares, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        const currentLabel = formatCurrency(tag.currentValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        const pnlValue = typeof tag.totalCost === 'number'
                          ? tag.currentValue - tag.totalCost
                          : null
                        const pnlLabel = pnlValue == null
                          ? '—'
                          : `${pnlValue >= 0 ? '+' : '-'}${formatCurrency(Math.abs(pnlValue), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        const pnlClass = pnlValue == null
                          ? (tag.currentValue >= 0 ? 'text-yes' : 'text-no')
                          : pnlValue >= 0
                            ? 'text-yes'
                            : 'text-no'
                        const canConvert = isNegRiskEnabled
                          && moneylineConditionIds.has(tag.conditionId)
                          && tag.outcomeIndex === OUTCOME_INDEX.NO
                          && tag.outcome.outcome_index === OUTCOME_INDEX.NO
                          && tag.shares > 0

                        return (
                          <tr key={tag.key} className="text-xs text-foreground">
                            <td className="py-2 font-medium">{tag.marketTypeLabel}</td>
                            <td className="px-2 py-2">
                              <span
                                className={cn(
                                  'inline-flex min-w-0 items-center rounded-sm px-2.5 py-1 text-xs font-semibold',
                                  tagAccent.className,
                                )}
                                style={tagAccent.style}
                              >
                                {`${tag.summaryLabel} | ${formatSharesLabel(tag.shares)}`}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right font-medium">
                              {formatAverageCellLabel(tag.avgPriceCents)}
                            </td>
                            <td className="px-2 py-2 text-right font-medium">{costLabel}</td>
                            <td className="px-2 py-2 text-right font-medium">{toWinLabel}</td>
                            <td className={cn('px-2 py-2 text-right font-medium', pnlClass)}>
                              {currentLabel}
                              {' '}
                              (
                              {pnlLabel}
                              )
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canConvert && (
                                  <button
                                    type="button"
                                    data-sports-card-control="true"
                                    className={`
                                      inline-flex h-7 items-center justify-center rounded-sm bg-secondary/70 px-2
                                      text-xs font-semibold text-foreground transition-colors
                                      hover:bg-secondary
                                    `}
                                    onClick={event => handleOpenConvert(tag, event)}
                                  >
                                    Convert
                                  </button>
                                )}
                                <button
                                  type="button"
                                  data-sports-card-control="true"
                                  className={`
                                    inline-flex h-7 items-center justify-center rounded-sm border border-border/70
                                    bg-background/40 px-2 text-xs font-semibold text-foreground transition-colors
                                    hover:bg-secondary/40
                                  `}
                                  onClick={event => void handleCashOutTag(tag, event)}
                                >
                                  Sell
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {convertDialogTag && (
        <EventConvertPositionsDialog
          open={Boolean(convertDialogTag)}
          options={convertDialogOptions}
          outcomes={convertDialogOutcomes}
          negRiskMarketId={card.event.neg_risk_market_id ?? undefined}
          isNegRiskAugmented={Boolean(card.event.neg_risk_augmented)}
          onOpenChange={(open) => {
            if (!open) {
              setConvertTagKey(null)
            }
          }}
        />
      )}

      {cashOutPayload && (
        <SellPositionModal
          open={Boolean(cashOutPayload)}
          onOpenChange={handleCashOutModalChange}
          outcomeLabel={cashOutPayload.outcomeLabel}
          outcomeShortLabel={cashOutPayload.outcomeShortLabel}
          outcomeIconUrl={cashOutPayload.outcomeIconUrl}
          fallbackIconUrl={card.event.icon_url}
          shares={cashOutPayload.shares}
          filledShares={cashOutPayload.filledShares}
          avgPriceCents={cashOutPayload.avgPriceCents}
          receiveAmount={cashOutPayload.receiveAmount}
          sellBids={cashOutPayload.sellBids}
          onSharesChange={sharesToSell =>
            setOrderAmount(formatAmountInputValue(sharesToSell, { roundingMode: 'floor' }))}
          onCashOut={handleCashOutSubmit}
          onEditOrder={(sharesToSell) => {
            setOrderAmount(formatAmountInputValue(sharesToSell, { roundingMode: 'floor' }))
            setCashOutPayload(null)
          }}
        />
      )}
    </>
  )
}

export default function SportsGamesCenter({ cards, sportSlug, sportTitle }: SportsGamesCenterProps) {
  const router = useRouter()
  const locale = useLocale()
  const isMobile = useIsMobile()
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [isDetailsContentVisible, setIsDetailsContentVisible] = useState(true)
  const [activeDetailsTab, setActiveDetailsTab] = useState<DetailsTab>('orderBook')
  const [selectedConditionByCardId, setSelectedConditionByCardId] = useState<Record<string, string>>({})
  const [tradeSelection, setTradeSelection] = useState<SportsTradeSelection>({ cardId: null, buttonKey: null })
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('price')
  const [showSpreadsAndTotals, setShowSpreadsAndTotals] = useState(true)
  const [hasLoadedOddsFormat, setHasLoadedOddsFormat] = useState(false)
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const setOrderEvent = useOrder(state => state.setEvent)
  const setOrderMarket = useOrder(state => state.setMarket)
  const setOrderOutcome = useOrder(state => state.setOutcome)
  const setOrderSide = useOrder(state => state.setSide)
  const orderMarketConditionId = useOrder(state => state.market?.condition_id ?? null)
  const orderOutcomeIndex = useOrder(state => state.outcome?.outcome_index ?? null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedOddsFormat = window.localStorage.getItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY)
    const matchedOption = ODDS_FORMAT_OPTIONS.find(option => option.value === storedOddsFormat)
    if (matchedOption) {
      setOddsFormat(matchedOption.value)
    }
    const storedShowSpreadsAndTotals = window.localStorage.getItem(SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY)
    if (storedShowSpreadsAndTotals === '0') {
      setShowSpreadsAndTotals(false)
    }
    setHasLoadedOddsFormat(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedOddsFormat || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY, oddsFormat)
    window.localStorage.setItem(
      SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY,
      showSpreadsAndTotals ? '1' : '0',
    )
  }, [hasLoadedOddsFormat, oddsFormat, showSpreadsAndTotals])

  const formatButtonOdds = useCallback((cents: number) => {
    if (oddsFormat === 'price') {
      return `${cents}¢`
    }
    return formatOddsFromCents(cents, oddsFormat)
  }, [oddsFormat])

  const resolveDisplayButtonKey = useCallback((
    card: SportsGamesCard,
    preferredKey: string | null | undefined,
  ) => {
    const preferredButton = preferredKey
      ? card.buttons.find(button => button.key === preferredKey) ?? null
      : null

    if (showSpreadsAndTotals) {
      return preferredButton?.key ?? resolveDefaultConditionId(card)
    }

    if (preferredButton?.marketType === 'moneyline') {
      return preferredButton.key
    }

    return card.buttons.find(button => button.marketType === 'moneyline')?.key
      ?? preferredButton?.key
      ?? resolveDefaultConditionId(card)
  }, [showSpreadsAndTotals])

  const visibleMarketColumns = useMemo(
    () => showSpreadsAndTotals
      ? MARKET_COLUMNS
      : MARKET_COLUMNS.filter(column => column.key === 'moneyline'),
    [showSpreadsAndTotals],
  )

  const weekOptions = useMemo(() => {
    const weeks = Array.from(new Set(
      cards
        .map(card => card.week)
        .filter((week): week is number => Number.isFinite(week)),
    ))

    return weeks.sort((a, b) => a - b)
  }, [cards])

  const [selectedWeek, setSelectedWeek] = useState<string>(
    weekOptions[0] != null ? String(weekOptions[0]) : 'all',
  )

  useEffect(() => {
    if (weekOptions.length === 0) {
      setSelectedWeek('all')
      return
    }

    const currentIsValid = selectedWeek !== 'all'
      && weekOptions.some(week => String(week) === selectedWeek)
    if (!currentIsValid) {
      setSelectedWeek(String(weekOptions[0]))
    }
  }, [selectedWeek, weekOptions])

  const weekFilteredCards = useMemo(() => {
    if (selectedWeek === 'all') {
      return cards
    }

    const week = Number(selectedWeek)
    return cards.filter(card => card.week === week)
  }, [cards, selectedWeek])

  useEffect(() => {
    if (!isSearchOpen) {
      return
    }
    searchInputRef.current?.focus()
  }, [isSearchOpen])

  useEffect(() => {
    if (!isSearchOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (searchShellRef.current?.contains(target)) {
        return
      }
      if (searchQuery.trim()) {
        return
      }
      setIsSearchOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isSearchOpen, searchQuery])

  const normalizedSearchQuery = useMemo(
    () => normalizeComparableText(searchQuery),
    [searchQuery],
  )

  const filteredCards = useMemo(() => {
    if (!normalizedSearchQuery) {
      return weekFilteredCards
    }

    return weekFilteredCards.filter((card) => {
      const searchableText = [
        card.title,
        card.event.title,
        card.event.slug,
        ...card.teams.flatMap(team => [team.name, team.abbreviation]),
      ]
        .map(value => normalizeComparableText(value))
        .join(' ')

      return searchableText.includes(normalizedSearchQuery)
    })
  }, [normalizedSearchQuery, weekFilteredCards])

  const emptyStateLabel = normalizedSearchQuery
    ? 'No games found for this search.'
    : 'No games available for this week.'

  useEffect(() => {
    if (openCardId && !filteredCards.some(card => card.id === openCardId)) {
      setOpenCardId(null)
      setIsDetailsContentVisible(true)
    }
  }, [filteredCards, openCardId])

  useEffect(() => {
    if (filteredCards.length === 0) {
      setTradeSelection({ cardId: null, buttonKey: null })
      return
    }

    setTradeSelection((current) => {
      const currentCard = current.cardId
        ? filteredCards.find(card => card.id === current.cardId) ?? null
        : null

      if (currentCard) {
        const currentButton = current.buttonKey
          ? currentCard.buttons.find(button => button.key === current.buttonKey) ?? null
          : null
        const currentButtonExists = Boolean(
          currentButton
          && (showSpreadsAndTotals || currentButton.marketType === 'moneyline'),
        )
        if (currentButtonExists) {
          return current
        }

        const preferredButtonKey = resolveDisplayButtonKey(
          currentCard,
          selectedConditionByCardId[currentCard.id] ?? resolveDefaultConditionId(currentCard),
        )
        const fallbackButtonKey = resolveSelectedButton(currentCard, preferredButtonKey)?.key ?? null
        return {
          cardId: currentCard.id,
          buttonKey: fallbackButtonKey,
        }
      }

      const firstCard = filteredCards[0]
      const preferredButtonKey = resolveDisplayButtonKey(
        firstCard,
        selectedConditionByCardId[firstCard.id] ?? resolveDefaultConditionId(firstCard),
      )
      const firstButtonKey = resolveSelectedButton(firstCard, preferredButtonKey)?.key ?? null
      return {
        cardId: firstCard.id,
        buttonKey: firstButtonKey,
      }
    })
  }, [filteredCards, resolveDisplayButtonKey, selectedConditionByCardId, showSpreadsAndTotals])

  const dateLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
    }),
    [locale],
  )

  const timeLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }),
    [locale],
  )

  const groupedCards = useMemo(() => {
    const grouped = new Map<string, { key: string, label: string, sortValue: number, cards: SportsGamesCard[] }>()

    for (const card of filteredCards) {
      const date = card.startTime ? new Date(card.startTime) : null
      const isValidDate = Boolean(date && !Number.isNaN(date.getTime()))
      const groupKey = isValidDate ? toDateGroupKey(date as Date) : 'tbd'
      const label = isValidDate ? dateLabelFormatter.format(date as Date) : 'Date TBD'
      const sortValue = isValidDate ? (date as Date).getTime() : Number.POSITIVE_INFINITY

      const existing = grouped.get(groupKey)
      if (existing) {
        existing.cards.push(card)
        continue
      }

      grouped.set(groupKey, {
        key: groupKey,
        label,
        sortValue,
        cards: [card],
      })
    }

    return Array.from(grouped.values()).sort((a, b) => a.sortValue - b.sortValue)
  }, [dateLabelFormatter, filteredCards])

  const activeTradeContext = useMemo<SportsActiveTradeContext | null>(() => {
    if (filteredCards.length === 0) {
      return null
    }

    const selectedCardFromTrade = tradeSelection.cardId
      ? filteredCards.find(card => card.id === tradeSelection.cardId) ?? null
      : null
    const selectedCardFromOpen = openCardId
      ? filteredCards.find(card => card.id === openCardId) ?? null
      : null
    const card = selectedCardFromTrade ?? selectedCardFromOpen ?? filteredCards[0] ?? null
    if (!card) {
      return null
    }

    const selectedButtonKey = resolveDisplayButtonKey(card, (
      tradeSelection.cardId === card.id
        ? tradeSelection.buttonKey
        : null
    ) ?? selectedConditionByCardId[card.id] ?? resolveDefaultConditionId(card))

    const button = resolveSelectedButton(card, selectedButtonKey)
    if (!button) {
      return null
    }

    const market = resolveSelectedMarket(card, button.key)
    if (!market) {
      return null
    }

    const outcome = resolveSelectedOutcome(market, button)
    if (!outcome) {
      return null
    }

    return {
      card,
      button,
      market,
      outcome,
    }
  }, [filteredCards, openCardId, resolveDisplayButtonKey, selectedConditionByCardId, tradeSelection.buttonKey, tradeSelection.cardId])

  const activeTradePrimaryOutcomeIndex = useMemo(() => {
    if (!activeTradeContext || activeTradeContext.button.marketType !== 'spread') {
      return null
    }

    return resolveStableSpreadPrimaryOutcomeIndex(
      activeTradeContext.card,
      activeTradeContext.button.conditionId,
    )
  }, [activeTradeContext])

  const activeTradeHeaderContext = useMemo<SportsActiveTradeContext | null>(() => {
    if (!activeTradeContext) {
      return null
    }

    if (!orderMarketConditionId || orderMarketConditionId !== activeTradeContext.market.condition_id) {
      return activeTradeContext
    }

    if (orderOutcomeIndex == null) {
      return activeTradeContext
    }

    const matchedOutcome = activeTradeContext.market.outcomes.find(
      outcome => outcome.outcome_index === orderOutcomeIndex,
    ) ?? activeTradeContext.outcome

    const matchedButton = activeTradeContext.card.buttons.find(
      button => (
        button.conditionId === activeTradeContext.market.condition_id
        && button.outcomeIndex === orderOutcomeIndex
      ),
    ) ?? activeTradeContext.button

    return {
      ...activeTradeContext,
      button: matchedButton,
      outcome: matchedOutcome,
    }
  }, [activeTradeContext, orderMarketConditionId, orderOutcomeIndex])

  useEffect(() => {
    if (!activeTradeContext) {
      return
    }

    setOrderEvent(activeTradeContext.card.event)
    setOrderMarket(activeTradeContext.market)
    setOrderOutcome(activeTradeContext.outcome)
    setOrderSide(ORDER_SIDE.BUY)
  }, [activeTradeContext, setOrderEvent, setOrderMarket, setOrderOutcome, setOrderSide])

  function toggleCard(
    card: SportsGamesCard,
    event?: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
  ) {
    if (event) {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-sports-card-control="true"]')) {
        return
      }
    }

    const defaultConditionId = resolveDefaultConditionId(card)
    const selectedButtonKey = resolveDisplayButtonKey(
      card,
      selectedConditionByCardId[card.id] ?? defaultConditionId,
    )
    const selectedButton = resolveSelectedButton(card, selectedButtonKey)
    const isSpreadOrTotalSelected = selectedButton?.marketType === 'spread' || selectedButton?.marketType === 'total'

    setTradeSelection({
      cardId: card.id,
      buttonKey: selectedButton?.key ?? defaultConditionId,
    })

    setSelectedConditionByCardId((current) => {
      if (!defaultConditionId || current[card.id]) {
        return current
      }

      return {
        ...current,
        [card.id]: defaultConditionId,
      }
    })

    if (openCardId !== card.id) {
      setOpenCardId(card.id)
      setIsDetailsContentVisible(true)
      setActiveDetailsTab('orderBook')
      return
    }

    if (isDetailsContentVisible) {
      if (isSpreadOrTotalSelected) {
        setIsDetailsContentVisible(false)
        return
      }

      setOpenCardId(null)
      setIsDetailsContentVisible(true)
      return
    }

    setIsDetailsContentVisible(true)
  }

  function selectCardButton(
    card: SportsGamesCard,
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) {
    const normalizedButtonKey = resolveDisplayButtonKey(card, buttonKey)
    if (!normalizedButtonKey) {
      return
    }

    setSelectedConditionByCardId((current) => {
      if (current[card.id] === normalizedButtonKey) {
        return current
      }

      return {
        ...current,
        [card.id]: normalizedButtonKey,
      }
    })

    setTradeSelection({
      cardId: card.id,
      buttonKey: normalizedButtonKey,
    })

    const panelMode = options?.panelMode ?? 'full'
    if (panelMode === 'partial') {
      setIsDetailsContentVisible(false)
    }
    else if (panelMode === 'full') {
      setActiveDetailsTab('orderBook')
      setIsDetailsContentVisible(true)
    }

    setOpenCardId(card.id)
  }

  const weekSelect = (
    <Select
      value={selectedWeek}
      onValueChange={setSelectedWeek}
      disabled={weekOptions.length === 0}
    >
      <SelectTrigger
        className={`
          h-12 w-fit min-w-0 cursor-pointer rounded-full border-0 bg-card px-3.5 pr-2 text-sm font-semibold
          text-foreground shadow-none
          hover:bg-card
          dark:bg-card
          dark:hover:bg-card
        `}
      >
        <SelectValue placeholder="Week" />
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="min-w-36 p-1">
        {weekOptions.map(week => (
          <SelectItem key={week} value={String(week)} className="my-0.5 cursor-pointer rounded-sm py-1.5 pl-2">
            {`Week ${week}`}
          </SelectItem>
        ))}
        {weekOptions.length === 0 && (
          <SelectItem value="all" className="my-0.5 cursor-pointer rounded-sm py-1.5 pl-2">
            No weeks
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )

  return (
    <>
      <div className="
        min-[1200px]:grid min-[1200px]:h-full min-[1200px]:grid-cols-[minmax(0,1fr)_21.25rem] min-[1200px]:gap-6
      "
      >
        <section
          data-sports-scroll-pane="center"
          className="min-w-0 min-[1200px]:min-h-0 min-[1200px]:overflow-y-auto min-[1200px]:pr-1 lg:ml-4"
        >
          <div className="mb-4">
            <div className="mb-3 flex items-start justify-between gap-3 lg:mt-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {sportTitle}
              </h1>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Odds format settings"
                    className={cn(headerIconButtonClass, 'size-auto p-0')}
                  >
                    <SettingsIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="w-56 border border-border bg-background p-1 text-foreground shadow-xl"
                >
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                    Odds Format
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ODDS_FORMAT_OPTIONS.map(option => (
                    <DropdownMenuItem
                      key={option.value}
                      className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-foreground"
                      onSelect={(event) => {
                        event.preventDefault()
                        setOddsFormat(option.value)
                      }}
                    >
                      <span>{option.label}</span>
                      {oddsFormat === option.value && <CheckIcon className="ml-auto size-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-sm px-2 py-1.5 text-sm whitespace-nowrap text-foreground"
                    onSelect={(event) => {
                      event.preventDefault()
                      setShowSpreadsAndTotals(current => !current)
                    }}
                  >
                    <span>Show Spreads + Totals</span>
                    {showSpreadsAndTotals && <CheckIcon className="ml-auto size-3.5 text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/sports/${sportSlug}/games` as Route)}
                  className={`
                    rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors
                  `}
                >
                  Games
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/sports/${sportSlug}/props` as Route)}
                  className="rounded-full bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors"
                >
                  Props
                </button>
              </div>

              <div className="ml-auto flex min-w-0 items-center justify-end">
                <div ref={searchShellRef} className="relative mr-2 flex h-11 items-center">
                  <div
                    className={cn(
                      `
                        absolute top-0 right-0 z-10 flex h-11 origin-right items-center overflow-hidden rounded-sm
                        bg-card transition-[width,opacity,transform,padding] duration-300 ease-out
                      `,
                      isSearchOpen
                        ? 'w-56 translate-x-0 scale-x-100 px-3 opacity-100'
                        : 'pointer-events-none w-0 translate-x-1.5 scale-x-95 px-0 opacity-0',
                    )}
                  >
                    <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      placeholder="Search"
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          if (searchQuery.trim()) {
                            setSearchQuery('')
                          }
                          else {
                            setIsSearchOpen(false)
                          }
                        }
                      }}
                      className={`
                        ml-2 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none
                        placeholder:text-muted-foreground
                      `}
                    />
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchQuery('')
                        setIsSearchOpen(false)
                      }}
                      className={`
                        ml-2 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground
                        transition-colors
                        hover:bg-muted/80 hover:text-foreground
                      `}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="Open search"
                    data-sports-card-control="true"
                    onClick={() => {
                      if (!isSearchOpen) {
                        setIsSearchOpen(true)
                        return
                      }
                      searchInputRef.current?.focus()
                    }}
                    className={cn(
                      `
                        relative z-20 flex h-11 w-11 items-center justify-center rounded-sm border border-transparent
                        bg-transparent text-foreground transition-colors
                        hover:bg-muted/80
                        focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
                      `,
                      isSearchOpen && 'pointer-events-none opacity-0',
                    )}
                  >
                    <SearchIcon className="size-4" />
                  </button>
                </div>

                {weekSelect}
              </div>
            </div>
          </div>

          {groupedCards.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              {emptyStateLabel}
            </div>
          )}

          <div className="space-y-5">
            {groupedCards.map(group => (
              <div key={group.key}>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <p className="text-lg font-semibold text-foreground">
                    {group.label}
                  </p>

                  {showSpreadsAndTotals && (
                    <div
                      className={cn(
                        'hidden gap-2 min-[1200px]:mr-2 min-[1200px]:ml-auto min-[1200px]:grid',
                        'w-[372px] grid-cols-3',
                      )}
                    >
                      {visibleMarketColumns.map(column => (
                        <div
                          key={`${group.key}-${column.key}-header`}
                          className="flex w-full items-center justify-center"
                        >
                          <p className="
                            text-center text-2xs font-semibold tracking-wide text-muted-foreground uppercase
                          "
                          >
                            {column.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {group.cards.map((card) => {
                    const parsedStartTime = card.startTime ? new Date(card.startTime) : null
                    const isValidTime = Boolean(parsedStartTime && !Number.isNaN(parsedStartTime.getTime()))
                    const timeLabel = isValidTime ? timeLabelFormatter.format(parsedStartTime as Date) : 'TBD'
                    const isExpanded = openCardId === card.id
                    const selectedButtonKey = resolveDisplayButtonKey(
                      card,
                      selectedConditionByCardId[card.id] ?? resolveDefaultConditionId(card),
                    )
                    const selectedButton = resolveSelectedButton(card, selectedButtonKey)
                    const isSpreadOrTotalSelected = selectedButton?.marketType === 'spread' || selectedButton?.marketType === 'total'
                    const shouldRenderDetailsPanel = isExpanded && (isDetailsContentVisible || isSpreadOrTotalSelected)
                    const activeMarketType = resolveActiveMarketType(card, selectedButtonKey)
                    const buttonGroups = groupButtonsByMarketType(card.buttons)

                    return (
                      <article
                        key={card.id}
                        className={cn(
                          `
                            cursor-pointer overflow-hidden rounded-xl border bg-card px-2.5 pt-2.5 shadow-md
                            shadow-black/4 transition-all
                          `,
                        )}
                      >
                        <div
                          className={cn(
                            `-mx-2.5 -mt-2.5 bg-card px-2.5 pt-2.5 pb-2 transition-colors hover:bg-secondary/30`,
                            shouldRenderDetailsPanel ? 'rounded-t-xl' : 'rounded-xl',
                          )}
                          role="button"
                          tabIndex={0}
                          onClick={event => toggleCard(card, event)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleCard(card, event)
                            }
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-foreground">
                                {timeLabel}
                              </span>
                              <span className="truncate text-sm font-semibold text-muted-foreground">
                                {formatVolume(card.volume)}
                                {' '}
                                Vol.
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Link
                                href={card.eventHref}
                                data-sports-card-control="true"
                                onClick={event => event.stopPropagation()}
                                className={cn(
                                  `
                                    inline-flex items-center gap-1 rounded-lg bg-secondary/80 px-2.5 py-1.5 text-xs
                                    font-semibold text-foreground transition-colors
                                  `,
                                  'hover:bg-secondary hover:ring-1 hover:ring-border',
                                )}
                              >
                                {card.marketsCount > 0 && (
                                  <span
                                    className={`
                                      inline-flex size-5 items-center justify-center rounded-sm bg-muted text-2xs
                                      font-semibold text-foreground/80
                                    `}
                                  >
                                    {card.marketsCount}
                                  </span>
                                )}
                                <span>Game View</span>
                                <ChevronRightIcon className="size-3.5" />
                              </Link>
                            </div>
                          </div>

                          <div className="
                            flex flex-col gap-2.5
                            min-[1200px]:flex-row min-[1200px]:items-center min-[1200px]:justify-between
                          "
                          >
                            <div className="min-w-0 flex-1 space-y-2">
                              {card.teams.map(team => (
                                <div
                                  key={`${card.id}-${team.abbreviation}-${team.name}`}
                                  className="flex items-center gap-2"
                                >
                                  <div className="flex size-6 shrink-0 items-center justify-center">
                                    {team.logoUrl
                                      ? (
                                          <Image
                                            src={team.logoUrl}
                                            alt={`${team.name} logo`}
                                            width={24}
                                            height={24}
                                            sizes="20px"
                                            className="h-[92%] w-[92%] object-contain object-center"
                                          />
                                        )
                                      : (
                                          <div
                                            className={`
                                              flex size-full items-center justify-center rounded-sm border
                                              border-border/40 text-2xs font-semibold text-muted-foreground
                                            `}
                                          >
                                            {team.abbreviation.slice(0, 1).toUpperCase()}
                                          </div>
                                        )}
                                  </div>

                                  <span className="truncate text-sm font-semibold text-foreground">
                                    {team.name}
                                  </span>

                                  {team.record && (
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {team.record}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            <div
                              data-sports-card-control="true"
                              className={cn(
                                'grid w-full grid-cols-1 gap-2',
                                showSpreadsAndTotals
                                  ? 'min-[1200px]:w-[372px] sm:grid-cols-3'
                                  : 'min-[1200px]:w-[372px] sm:grid-cols-1',
                              )}
                            >
                              {visibleMarketColumns.map((column) => {
                                const columnButtons = buttonGroups[column.key]
                                if (columnButtons.length === 0) {
                                  return null
                                }

                                const isMoneylineOnlyLayout = !showSpreadsAndTotals && column.key === 'moneyline'

                                const renderedButtons = (() => {
                                  if (column.key === 'moneyline') {
                                    return columnButtons
                                  }

                                  const buttonsByConditionId = new Map<string, SportsGamesButton[]>()
                                  for (const button of columnButtons) {
                                    const existing = buttonsByConditionId.get(button.conditionId)
                                    if (existing) {
                                      existing.push(button)
                                      continue
                                    }
                                    buttonsByConditionId.set(button.conditionId, [button])
                                  }

                                  const orderedConditionIds = Array.from(buttonsByConditionId.keys())
                                  const activeConditionId = selectedButton?.marketType === column.key
                                    ? selectedButton.conditionId
                                    : orderedConditionIds[0]

                                  const selectedButtons = buttonsByConditionId.get(activeConditionId ?? '')
                                    ?? (orderedConditionIds[0] ? buttonsByConditionId.get(orderedConditionIds[0]) : [])
                                    ?? []

                                  if (column.key === 'spread') {
                                    const spreadOrder: Record<SportsGamesButton['tone'], number> = {
                                      team1: 0,
                                      team2: 1,
                                      draw: 2,
                                      over: 3,
                                      under: 4,
                                      neutral: 5,
                                    }

                                    return [...selectedButtons].sort((a, b) => (
                                      (spreadOrder[a.tone] ?? 99) - (spreadOrder[b.tone] ?? 99)
                                    ))
                                  }

                                  return selectedButtons
                                })()

                                if (renderedButtons.length === 0) {
                                  return null
                                }

                                return (
                                  <div
                                    key={`${card.id}-${column.key}`}
                                    className={cn(
                                      'w-full gap-2',
                                      isMoneylineOnlyLayout ? 'grid grid-cols-3' : 'flex flex-col',
                                    )}
                                  >
                                    {renderedButtons.map((button) => {
                                      const isActiveColumn = activeMarketType === button.marketType
                                      const isMoneylineColumn = button.marketType === 'moneyline'
                                      const hasTeamColor = isActiveColumn
                                        && (button.tone === 'team1' || button.tone === 'team2')
                                        && Boolean(button.color)
                                      const isOverButton = isActiveColumn && button.tone === 'over'
                                      const isUnderButton = isActiveColumn && button.tone === 'under'

                                      return (
                                        <div key={button.key} className="relative overflow-hidden rounded-lg pb-1.25">
                                          <div
                                            className={cn(
                                              'pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg',
                                              !hasTeamColor && !isOverButton && !isUnderButton && 'bg-border/70',
                                              isOverButton && 'bg-yes/70',
                                              isUnderButton && 'bg-no/70',
                                            )}
                                            style={hasTeamColor ? resolveButtonDepthStyle(button.color) : undefined}
                                          />
                                          <button
                                            type="button"
                                            data-sports-card-control="true"
                                            onClick={(event) => {
                                              event.preventDefault()
                                              event.stopPropagation()
                                              const panelMode = column.key === 'moneyline'
                                                ? 'full'
                                                : (isExpanded ? 'preserve' : 'partial')
                                              selectCardButton(card, button.key, {
                                                panelMode,
                                              })
                                            }}
                                            style={hasTeamColor ? resolveButtonStyle(button.color) : undefined}
                                            className={cn(
                                              `
                                                relative flex w-full translate-y-0 items-center justify-center
                                                rounded-lg px-2 font-semibold shadow-sm transition-transform
                                                duration-150 ease-out
                                                hover:translate-y-px
                                                active:translate-y-0.5
                                              `,
                                              isMoneylineOnlyLayout
                                                ? 'h-11 text-xs'
                                                : (isMoneylineColumn ? 'h-9 text-xs' : 'h-[58px] text-xs'),
                                              !hasTeamColor && !isOverButton && !isUnderButton
                                              && 'bg-secondary text-secondary-foreground hover:bg-accent',
                                              isOverButton && 'bg-yes text-white hover:bg-yes-foreground',
                                              isUnderButton && 'bg-no text-white hover:bg-no-foreground',
                                            )}
                                          >
                                            <span className={cn('opacity-80', isMoneylineColumn ? 'mr-1' : 'mr-2')}>
                                              {button.label}
                                            </span>
                                            <span className="text-sm leading-none tabular-nums">
                                              {formatButtonOdds(button.cents)}
                                            </span>
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div
                          className={cn(
                            '-mx-2.5 bg-card px-2.5 empty:hidden',
                            shouldRenderDetailsPanel
                              ? 'border-t pt-3'
                              : (isSpreadOrTotalSelected ? 'pt-3' : 'pt-0'),
                          )}
                          onClick={event => event.stopPropagation()}
                        >
                          <SportsGameDetailsPanel
                            card={card}
                            activeDetailsTab={activeDetailsTab}
                            selectedButtonKey={selectedButtonKey}
                            showBottomContent={shouldRenderDetailsPanel ? isDetailsContentVisible : false}
                            oddsFormat={oddsFormat}
                            onChangeTab={setActiveDetailsTab}
                            onSelectButton={(buttonKey, options) => selectCardButton(card, buttonKey, options)}
                          />
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside
          data-sports-scroll-pane="aside"
          className={`
            hidden gap-4
            min-[1200px]:sticky min-[1200px]:top-0 min-[1200px]:grid min-[1200px]:max-h-full min-[1200px]:self-start
            min-[1200px]:overflow-y-auto
          `}
        >
          {activeTradeContext
            ? (
                <div className="grid gap-6">
                  <EventOrderPanelForm
                    isMobile={false}
                    event={activeTradeContext.card.event}
                    oddsFormat={oddsFormat}
                    outcomeButtonStyleVariant="sports3d"
                    desktopMarketInfo={(
                      <SportsOrderPanelMarketInfo
                        card={activeTradeHeaderContext?.card ?? activeTradeContext.card}
                        selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
                        selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
                        marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
                      />
                    )}
                    primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
                  />
                  <EventOrderPanelTermsDisclaimer />
                </div>
              )
            : (
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  Select a market to trade.
                </div>
              )}
        </aside>
      </div>

      {isMobile && activeTradeContext && (
        <EventOrderPanelMobile
          event={activeTradeContext.card.event}
          oddsFormat={oddsFormat}
          outcomeButtonStyleVariant="sports3d"
          mobileMarketInfo={(
            <SportsOrderPanelMarketInfo
              card={activeTradeHeaderContext?.card ?? activeTradeContext.card}
              selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
              selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
              marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
            />
          )}
          primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
        />
      )}
    </>
  )
}

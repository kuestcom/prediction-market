'use client'

import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'
import type { SportsGamesButton, SportsGamesCard } from '@/app/[locale]/(platform)/sports/_components/sports-games-data'
import type { Market, Outcome } from '@/types'
import type { DataPoint, PredictionChartCursorSnapshot, PredictionChartProps } from '@/types/PredictionChartTypes'
import { ChevronLeftIcon, ChevronRightIcon, EqualIcon, RefreshCwIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import EventOrderBook, { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import { useEventPriceHistory } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useWindowSize } from '@/hooks/useWindowSize'
import { Link } from '@/i18n/navigation'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { formatVolume } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'

interface SportsGamesCenterProps {
  cards: SportsGamesCard[]
}

type DetailsTab = 'orderBook' | 'graph'
type SportsGamesMarketType = SportsGamesButton['marketType']
type LinePickerMarketType = Extract<SportsGamesMarketType, 'spread' | 'total'>

const MARKET_COLUMNS: Array<{ key: SportsGamesMarketType, label: string }> = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
]

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

function resolveButtonStyle(color: string | null): CSSProperties | undefined {
  const normalized = normalizeHexColor(color)
  if (!normalized) {
    return undefined
  }

  return {
    backgroundColor: normalized,
    color: '#fff',
  }
}

function resolveButtonDepthStyle(color: string | null): CSSProperties | undefined {
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

function groupButtonsByMarketType(buttons: SportsGamesButton[]) {
  const grouped: Record<SportsGamesMarketType, SportsGamesButton[]> = {
    moneyline: [],
    spread: [],
    total: [],
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

function resolveDefaultConditionId(card: SportsGamesCard) {
  return card.defaultConditionId
    ?? card.buttons[0]?.key
    ?? card.detailMarkets[0]?.condition_id
    ?? null
}

function resolveSelectedButton(card: SportsGamesCard, selectedButtonKey: string | null) {
  if (selectedButtonKey) {
    const selected = card.buttons.find(button => button.key === selectedButtonKey)
    if (selected) {
      return selected
    }
  }

  return card.buttons[0] ?? null
}

function resolveSelectedMarket(card: SportsGamesCard, selectedButtonKey: string | null) {
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

function resolveSelectedOutcome(market: Market | null, selectedButton: SportsGamesButton | null): Outcome | null {
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

function resolveStableSpreadPrimaryOutcomeIndex(card: SportsGamesCard, conditionId: string) {
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
    return 'var(--primary)'
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

function SportsGameGraph({
  card,
  selectedMarketType,
  selectedConditionId,
}: {
  card: SportsGamesCard
  selectedMarketType: SportsGamesMarketType
  selectedConditionId: string | null
}) {
  const { width: windowWidth } = useWindowSize()
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const isSecondaryMarketGraph = selectedMarketType === 'spread' || selectedMarketType === 'total'

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
    range: '1W',
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

    const nowMs = Date.now()
    const createdMs = Date.parse(card.eventCreatedAt)
    const endMs = Number.isFinite(createdMs)
      ? Math.max(createdMs + 60_000, nowMs)
      : nowMs
    const startMs = Number.isFinite(createdMs)
      ? Math.min(createdMs, endMs - (30 * 60_000))
      : endMs - (30 * 60_000)

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
  }, [card.eventCreatedAt, graphSeriesTargets])

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

  const legendContent = !isSecondaryMarketGraph && legendSeriesWithValues.length > 0
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

  const chartWidth = useMemo(() => {
    const viewportWidth = windowWidth ?? 1200

    if (viewportWidth < 768) {
      return Math.max(260, viewportWidth - 112)
    }

    return Math.min(860, viewportWidth - 520)
  }, [windowWidth])

  if (graphSeriesTargets.length === 0) {
    return (
      <div className="rounded-lg border bg-secondary/30 px-3 py-6 text-sm text-muted-foreground">
        Graph is unavailable for this game.
      </div>
    )
  }

  return (
    <PredictionChart
      data={chartData}
      series={chartSeries}
      width={chartWidth}
      height={300}
      margin={{ top: 12, right: 30, bottom: 40, left: 0 }}
      dataSignature={`${card.id}:${chartSeries.map(series => series.key).join(',')}:1w`}
      onCursorDataChange={setCursorSnapshot}
      xAxisTickCount={3}
      yAxis={undefined}
      legendContent={legendContent}
      showLegend={!isSecondaryMarketGraph}
      showTooltipSeriesLabels
      lineCurve="monotoneX"
      tooltipValueFormatter={value => `${Math.round(value)}%`}
    />
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

function resolveTradeHeaderTitle({
  card,
  selectedButton,
  marketType,
}: {
  card: SportsGamesCard
  selectedButton: SportsGamesButton
  marketType: SportsGamesMarketType
}) {
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
    return {
      className: '',
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

function SportsOrderPanelMarketInfo({
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

  return (
    <div className="mb-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {marketType === 'total'
            ? <TotalBadge button={selectedButton} />
            : selectedButton.tone === 'draw'
              ? <DrawBadge />
              : <TeamLogoBadge card={card} button={selectedButton} />}
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
  onChangeTab: (tab: DetailsTab) => void
  onSelectButton: (
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) => void
}

function SportsGameDetailsPanel({
  card,
  activeDetailsTab,
  selectedButtonKey,
  showBottomContent,
  onChangeTab,
  onSelectButton,
}: SportsGameDetailsPanelProps) {
  const linePickerScrollerRef = useRef<HTMLDivElement | null>(null)
  const linePickerButtonsRef = useRef<Record<string, HTMLButtonElement | null>>({})
  const [selectedOutcomeIndexOverride, setSelectedOutcomeIndexOverride] = useState<number | null>(null)
  const [linePickerStartSpacer, setLinePickerStartSpacer] = useState(0)
  const [linePickerEndSpacer, setLinePickerEndSpacer] = useState(0)

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

    if (selectedOutcomeIndexOverride !== null) {
      const overrideOutcome = selectedMarket.outcomes.find(
        outcome => outcome.outcome_index === selectedOutcomeIndexOverride,
      )
      if (overrideOutcome) {
        return overrideOutcome
      }
    }

    return resolveSelectedOutcome(selectedMarket, selectedButton)
  }, [selectedButton, selectedMarket, selectedOutcomeIndexOverride])

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

    setSelectedOutcomeIndexOverride(nextOutcome.outcome_index)
  }, [nextOutcome])

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

    activeButton.scrollIntoView({
      behavior,
      inline: 'center',
      block: 'nearest',
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
    setSelectedOutcomeIndexOverride(null)
  }, [card.id, selectedButton?.conditionId, selectedButtonKey])

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
    enabled: activeDetailsTab === 'orderBook' && selectedMarketTokenIds.length > 0,
  })

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
          <div className={cn('-mx-2.5 px-2.5', showBottomContent ? 'pb-3' : 'pb-2')}>
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
          </div>
        )}
      </div>

      {showBottomContent && (
        <>
          <div className="-mx-2.5 mb-3 border-b">
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
                      <div className="-mx-2.5 -mb-2.5">
                        <EventOrderBook
                          market={selectedMarket}
                          outcome={selectedOutcome}
                          summaries={orderBookSummaries}
                          isLoadingSummaries={isOrderBookLoading && !orderBookSummaries}
                          eventSlug={card.slug}
                          surfaceVariant="embedded"
                          tradeLabel={`TRADE ${tradeSelectionLabel}`}
                          onToggleOutcome={nextOutcome ? handleToggleOutcome : undefined}
                          toggleOutcomeTooltip={switchTooltip ?? undefined}
                        />
                      </div>
                    )
                  : (
                      <div className="rounded-lg border bg-secondary/30 px-3 py-6 text-sm text-muted-foreground">
                        Order book is unavailable for this game.
                      </div>
                    )
              )
            : (
                <SportsGameGraph
                  card={card}
                  selectedMarketType={selectedButton?.marketType ?? 'moneyline'}
                  selectedConditionId={selectedButton?.conditionId ?? null}
                />
              )}
        </>
      )}
    </>
  )
}

export default function SportsGamesCenter({ cards }: SportsGamesCenterProps) {
  const locale = useLocale()
  const isMobile = useIsMobile()
  const [sectionActionsHost, setSectionActionsHost] = useState<HTMLElement | null>(null)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [isDetailsContentVisible, setIsDetailsContentVisible] = useState(true)
  const [activeDetailsTab, setActiveDetailsTab] = useState<DetailsTab>('orderBook')
  const [selectedConditionByCardId, setSelectedConditionByCardId] = useState<Record<string, string>>({})
  const [tradeSelection, setTradeSelection] = useState<SportsTradeSelection>({ cardId: null, buttonKey: null })
  const setOrderEvent = useOrder(state => state.setEvent)
  const setOrderMarket = useOrder(state => state.setMarket)
  const setOrderOutcome = useOrder(state => state.setOutcome)
  const setOrderSide = useOrder(state => state.setSide)

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
    setSectionActionsHost(document.getElementById('sports-section-row-actions'))
  }, [])

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

  const filteredCards = useMemo(() => {
    if (selectedWeek === 'all') {
      return cards
    }

    const week = Number(selectedWeek)
    return cards.filter(card => card.week === week)
  }, [cards, selectedWeek])

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
        const currentButtonExists = Boolean(
          current.buttonKey && currentCard.buttons.some(button => button.key === current.buttonKey),
        )
        if (currentButtonExists) {
          return current
        }

        const preferredButtonKey = selectedConditionByCardId[currentCard.id] ?? resolveDefaultConditionId(currentCard)
        const fallbackButtonKey = resolveSelectedButton(currentCard, preferredButtonKey)?.key ?? null
        return {
          cardId: currentCard.id,
          buttonKey: fallbackButtonKey,
        }
      }

      const firstCard = filteredCards[0]
      const preferredButtonKey = selectedConditionByCardId[firstCard.id] ?? resolveDefaultConditionId(firstCard)
      const firstButtonKey = resolveSelectedButton(firstCard, preferredButtonKey)?.key ?? null
      return {
        cardId: firstCard.id,
        buttonKey: firstButtonKey,
      }
    })
  }, [filteredCards, selectedConditionByCardId])

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

    const selectedButtonKey = (
      tradeSelection.cardId === card.id
        ? tradeSelection.buttonKey
        : null
    ) ?? selectedConditionByCardId[card.id] ?? resolveDefaultConditionId(card)

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
  }, [filteredCards, openCardId, selectedConditionByCardId, tradeSelection.buttonKey, tradeSelection.cardId])

  const activeTradePrimaryOutcomeIndex = useMemo(() => {
    if (!activeTradeContext || activeTradeContext.button.marketType !== 'spread') {
      return null
    }

    return resolveStableSpreadPrimaryOutcomeIndex(
      activeTradeContext.card,
      activeTradeContext.button.conditionId,
    )
  }, [activeTradeContext])

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
    const selectedButtonKey = selectedConditionByCardId[card.id] ?? defaultConditionId
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
    setSelectedConditionByCardId((current) => {
      if (current[card.id] === buttonKey) {
        return current
      }

      return {
        ...current,
        [card.id]: buttonKey,
      }
    })

    setTradeSelection({
      cardId: card.id,
      buttonKey,
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
          h-11 w-auto min-w-0 cursor-pointer rounded-full border-0 bg-card px-6 text-sm font-semibold text-foreground
          shadow-none
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
      {sectionActionsHost
        ? createPortal(weekSelect, sectionActionsHost)
        : (
            <div className="mb-4 flex items-center justify-end">
              {weekSelect}
            </div>
          )}

      <div className="min-[1200px]:grid min-[1200px]:grid-cols-[minmax(0,1fr)_21.25rem] min-[1200px]:gap-6">
        <section className="min-w-0 lg:ml-4">
          {groupedCards.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              No games available for this week.
            </div>
          )}

          <div className="space-y-5">
            {groupedCards.map(group => (
              <div key={group.key}>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <p className="text-lg font-semibold text-foreground">
                    {group.label}
                  </p>

                  <div className="
                    hidden w-[372px] grid-cols-3 gap-2
                    min-[1200px]:mr-2 min-[1200px]:ml-auto min-[1200px]:grid
                  "
                  >
                    {MARKET_COLUMNS.map(column => (
                      <div key={`${group.key}-${column.key}-header`} className="flex w-full items-center justify-center">
                        <p className="text-center text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {column.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {group.cards.map((card) => {
                    const parsedStartTime = card.startTime ? new Date(card.startTime) : null
                    const isValidTime = Boolean(parsedStartTime && !Number.isNaN(parsedStartTime.getTime()))
                    const timeLabel = isValidTime ? timeLabelFormatter.format(parsedStartTime as Date) : 'TBD'
                    const isExpanded = openCardId === card.id
                    const selectedButtonKey = selectedConditionByCardId[card.id] ?? resolveDefaultConditionId(card)
                    const selectedButton = resolveSelectedButton(card, selectedButtonKey)
                    const isSpreadOrTotalSelected = selectedButton?.marketType === 'spread' || selectedButton?.marketType === 'total'
                    const shouldRenderDetailsPanel = isExpanded && (isDetailsContentVisible || isSpreadOrTotalSelected)
                    const activeMarketType = resolveActiveMarketType(card, selectedButtonKey)
                    const buttonGroups = groupButtonsByMarketType(card.buttons)

                    return (
                      <article
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        onClick={event => toggleCard(card, event)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            toggleCard(card, event)
                          }
                        }}
                        className={cn(
                          `
                            group cursor-pointer overflow-hidden rounded-xl border bg-secondary/40 p-2.5 shadow-md
                            shadow-black/4 transition-all
                            hover:shadow-black/8
                          `,
                        )}
                      >
                        <div
                          className={cn(
                            `-mx-2.5 -mt-2.5 px-2.5 pt-2.5 pb-2 transition-colors group-hover:bg-card`,
                            shouldRenderDetailsPanel ? 'rounded-t-xl' : '-mb-2.5 rounded-xl',
                          )}
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
                                      inline-flex size-5 items-center justify-center rounded-sm bg-background text-2xs
                                      font-semibold text-muted-foreground
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
                              className="grid w-full grid-cols-1 gap-2 min-[1200px]:w-[372px] sm:grid-cols-3"
                            >
                              {MARKET_COLUMNS.map((column) => {
                                const columnButtons = buttonGroups[column.key]
                                if (columnButtons.length === 0) {
                                  return null
                                }

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
                                  <div key={`${card.id}-${column.key}`} className="flex w-full flex-col gap-2">
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
                                              isMoneylineColumn ? 'h-9 text-xs' : 'h-[58px] text-xs',
                                              !hasTeamColor && !isOverButton && !isUnderButton
                                              && 'bg-secondary text-secondary-foreground hover:bg-accent',
                                              isOverButton && 'bg-yes text-white hover:bg-yes-foreground',
                                              isUnderButton && 'bg-no text-white hover:bg-no-foreground',
                                            )}
                                          >
                                            <span className={cn('opacity-80', isMoneylineColumn ? 'mr-1' : 'mr-2')}>
                                              {button.label}
                                            </span>
                                            <span className="text-[11px] tabular-nums">
                                              {`${button.cents}¢`}
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

                        {shouldRenderDetailsPanel && (
                          <div
                            className={cn(
                              '-mx-2.5 border-t px-2.5',
                              'pt-3',
                            )}
                            onClick={event => event.stopPropagation()}
                          >
                            <SportsGameDetailsPanel
                              card={card}
                              activeDetailsTab={activeDetailsTab}
                              selectedButtonKey={selectedButtonKey}
                              showBottomContent={isDetailsContentVisible}
                              onChangeTab={setActiveDetailsTab}
                              onSelectButton={(buttonKey, options) => selectCardButton(card, buttonKey, options)}
                            />
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside
          className={`
            hidden gap-4
            min-[1200px]:sticky min-[1200px]:top-38 min-[1200px]:-mt-26 min-[1200px]:grid
            min-[1200px]:max-h-[calc(100vh-7rem)] min-[1200px]:self-start min-[1200px]:overflow-y-auto
          `}
        >
          {activeTradeContext
            ? (
                <div className="grid gap-6">
                  <EventOrderPanelForm
                    isMobile={false}
                    event={activeTradeContext.card.event}
                    desktopMarketInfo={(
                      <SportsOrderPanelMarketInfo
                        card={activeTradeContext.card}
                        selectedButton={activeTradeContext.button}
                        selectedOutcome={activeTradeContext.outcome}
                        marketType={activeTradeContext.button.marketType}
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
          mobileMarketInfo={(
            <SportsOrderPanelMarketInfo
              card={activeTradeContext.card}
              selectedButton={activeTradeContext.button}
              selectedOutcome={activeTradeContext.outcome}
              marketType={activeTradeContext.button.marketType}
            />
          )}
          primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
        />
      )}
    </>
  )
}

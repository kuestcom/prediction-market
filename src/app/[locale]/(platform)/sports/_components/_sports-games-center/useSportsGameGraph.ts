import type { SportsPositionedLegendLayout } from './sports-games-center-constants'
import type { SportsGameGraphVariant, SportsGraphSeriesTarget, SportsTradeFlowLabelItem } from './sports-games-center-types'
import type { TIME_RANGES } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { DataPoint, PredictionChartCursorSnapshot } from '@/types/PredictionChartTypes'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOptionalMarketChannelSubscription } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import { useEventPriceHistory } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { loadStoredChartSettings, storeChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_utils/chartSettingsStorage'
import { OUTCOME_INDEX } from '@/lib/constants'
import { calculateYAxisBounds } from '@/lib/prediction-chart'
import {
  SPORTS_CARD_POSITIONED_LEGEND_LAYOUT,
  SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT,
  TRADE_FLOW_CLEANUP_INTERVAL_MS,
} from './sports-games-center-constants'
import {
  buildCompositeMoneylineGraphTargets,
  buildTradeFlowLabel,
  normalizeOutcomePriceCents,
  pruneTradeFlowItems,
  resolveGraphSeriesColor,
  resolveGraphSeriesName,
  trimTradeFlowItems,
} from './sports-games-center-utils'

export function useSportsGameGraphChartSettings() {
  const [chartSettings, setChartSettings] = useState(function resolveInitialGraphChartSettings() {
    const stored = loadStoredChartSettings()
    return { ...stored, bothOutcomes: false }
  })

  useEffect(function persistGraphChartSettings() {
    storeChartSettings({ ...chartSettings, bothOutcomes: false })
    return function noopGraphChartSettingsCleanup() {}
  }, [chartSettings])

  return [chartSettings, setChartSettings] as const
}

export function useSportsGameGraphChartDimensions({
  containerWidth,
  windowWidth,
  variant,
}: {
  containerWidth?: number | null
  windowWidth: number | undefined
  variant: SportsGameGraphVariant
}) {
  const isSportsEventHeroVariant = variant === 'sportsEventHero'
  const usesPositionedSeriesLegend = variant === 'sportsEventHero' || variant === 'sportsCardLegend'
  const positionedLegendLayout = isSportsEventHeroVariant
    ? SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT
    : SPORTS_CARD_POSITIONED_LEGEND_LAYOUT
  const chartHeight = isSportsEventHeroVariant ? 332 : 300
  const chartMargin = usesPositionedSeriesLegend
    ? { top: 12, right: 46, bottom: 40, left: 0 }
    : { top: 12, right: 30, bottom: 40, left: 0 }

  const chartWidth = useMemo(() => {
    if (typeof containerWidth === 'number' && Number.isFinite(containerWidth) && containerWidth > 0) {
      return Math.max(1, Math.round(containerWidth))
    }

    const viewportWidth = windowWidth ?? 1200

    if (viewportWidth < 768) {
      return Math.max(260, viewportWidth - 112)
    }

    return Math.min(860, viewportWidth - 520)
  }, [containerWidth, windowWidth])

  return {
    isSportsEventHeroVariant,
    usesPositionedSeriesLegend,
    canRenderPositionedSeriesLegend: usesPositionedSeriesLegend,
    positionedLegendLayout,
    chartHeight,
    chartMargin,
    chartWidth,
  }
}

export function useSportsGameGraphSeries({
  card,
  selectedConditionId,
  isSecondaryMarketGraph,
  isSportsEventHeroVariant,
}: {
  card: SportsGamesCard
  selectedConditionId: string | null
  isSecondaryMarketGraph: boolean
  isSportsEventHeroVariant: boolean
}) {
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
                color: resolveGraphSeriesColor(card, relatedButton, fallbackColors[index % fallbackColors.length]!),
              }
            })

          if (outcomeTargets.length > 0) {
            return outcomeTargets
          }
        }
      }

      const fallbackColors = ['var(--yes)', 'var(--primary)', 'var(--no)']

      const compositeMoneylineTargets = buildCompositeMoneylineGraphTargets(card)
      if (compositeMoneylineTargets.length > 0) {
        return compositeMoneylineTargets
      }

      const moneylineConditionIds = Array.from(new Set(
        card.buttons
          .filter(button => button.marketType === 'moneyline')
          .map(button => button.conditionId),
      ))

      const moneylineMarkets = moneylineConditionIds
        .map(conditionId => card.detailMarkets.find(market => market.condition_id === conditionId) ?? null)
        .filter((market): market is NonNullable<typeof market> => Boolean(market))

      if (moneylineMarkets.length > 0) {
        return moneylineMarkets
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
              color: resolveGraphSeriesColor(card, relatedButton, fallbackColors[index % fallbackColors.length]!),
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
          color: resolveGraphSeriesColor(card, relatedButton, fallbackColors[fallbackTargets.length % fallbackColors.length]!),
        })
      }

      return fallbackTargets
    },
    [card, isSecondaryMarketGraph, selectedConditionId],
  )

  const tradeFlowSeriesByTokenId = useMemo(() => {
    const map = new Map<string, { color: string }>()
    if (!isSportsEventHeroVariant) {
      return map
    }

    for (const series of graphSeriesTargets) {
      if (!series.tokenId) {
        continue
      }
      map.set(String(series.tokenId), {
        color: series.color,
      })
    }

    return map
  }, [graphSeriesTargets, isSportsEventHeroVariant])

  const marketTargets = useMemo(
    () => graphSeriesTargets
      .filter((target): target is SportsGraphSeriesTarget & { tokenId: string } => Boolean(target.tokenId))
      .map(target => ({
        conditionId: target.key,
        tokenId: target.tokenId,
      })),
    [graphSeriesTargets],
  )

  const chartSeries = useMemo(() => {
    return graphSeriesTargets.map(target => ({
      key: target.key,
      name: target.name,
      color: target.color,
    }))
  }, [graphSeriesTargets])

  return { graphSeriesTargets, tradeFlowSeriesByTokenId, marketTargets, chartSeries }
}

export function useSportsGameGraphHistory({
  card,
  marketTargets,
  activeTimeRange,
  chartSeries,
  graphSeriesTargets,
  isSecondaryMarketGraph,
}: {
  card: SportsGamesCard
  marketTargets: Array<{ conditionId: string, tokenId: string }>
  activeTimeRange: (typeof TIME_RANGES)[number]
  chartSeries: Array<{ key: string, name: string, color: string }>
  graphSeriesTargets: SportsGraphSeriesTarget[]
  isSecondaryMarketGraph: boolean
}) {
  const { normalizedHistory } = useEventPriceHistory({
    eventId: card.id,
    range: activeTimeRange,
    targets: marketTargets,
    eventCreatedAt: card.eventCreatedAt,
    eventResolvedAt: card.eventResolvedAt,
  })
  const leadingGapStart = normalizedHistory[0]?.date ?? null

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

  return { chartData, latestSnapshot, leadingGapStart }
}

export function useSportsGameGraphHeroLegend({
  canRenderPositionedSeriesLegend,
  chartSeries,
  chartData,
  chartWidth,
  chartHeight,
  chartMargin,
  cursorSnapshot,
  latestSnapshot,
  positionedLegendLayout,
  usesPositionedSeriesLegend,
}: {
  canRenderPositionedSeriesLegend: boolean
  chartSeries: Array<{ key: string, name: string, color: string }>
  chartData: DataPoint[]
  chartWidth: number
  chartHeight: number
  chartMargin: { top: number, right: number, bottom: number, left: number }
  cursorSnapshot: PredictionChartCursorSnapshot | null
  latestSnapshot: Record<string, number>
  positionedLegendLayout: SportsPositionedLegendLayout
  usesPositionedSeriesLegend: boolean
}) {
  const heroLegendSeriesWithValues = useMemo(
    () => {
      if (!canRenderPositionedSeriesLegend) {
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
    [canRenderPositionedSeriesLegend, chartSeries, cursorSnapshot, latestSnapshot],
  )

  const heroLegendRenderedWidth = useMemo(() => {
    if (!canRenderPositionedSeriesLegend || chartSeries.length === 0) {
      return positionedLegendLayout.minWidthPx
    }

    if (typeof document === 'undefined') {
      return positionedLegendLayout.minWidthPx
    }

    const context = document.createElement('canvas').getContext('2d')
    if (!context) {
      return positionedLegendLayout.minWidthPx
    }

    context.font = positionedLegendLayout.nameFont

    const longestLabelWidth = chartSeries.reduce((maxWidth, seriesItem) => {
      const label = seriesItem.name.trim()
      if (!label) {
        return maxWidth
      }

      return Math.max(maxWidth, context.measureText(label).width)
    }, 0)

    context.font = positionedLegendLayout.valueFont
    const widestValueWidth = heroLegendSeriesWithValues.reduce((maxWidth, entry) => {
      const label = `${Math.round(entry.value)}%`
      return Math.max(maxWidth, context.measureText(label).width)
    }, context.measureText('100%').width)

    const targetWidth = Math.ceil(
      Math.max(longestLabelWidth, widestValueWidth)
      + positionedLegendLayout.horizontalPaddingPx,
    )
    return Math.max(positionedLegendLayout.minWidthPx, targetWidth)
  }, [canRenderPositionedSeriesLegend, chartSeries, heroLegendSeriesWithValues, positionedLegendLayout])

  const chartXDomain = useMemo(() => {
    if (!usesPositionedSeriesLegend || chartData.length < 2) {
      return undefined
    }

    const firstPoint = chartData[0]
    const lastPoint = chartData.at(-1)
    if (!firstPoint || !lastPoint) {
      return undefined
    }

    const firstTimestamp = firstPoint.date.getTime()
    const lastTimestamp = lastPoint.date.getTime()
    if (!Number.isFinite(firstTimestamp) || !Number.isFinite(lastTimestamp) || lastTimestamp <= firstTimestamp) {
      return undefined
    }

    const dataSpanMs = Math.max(1, lastTimestamp - firstTimestamp)
    const plotWidthPx = Math.max(1, chartWidth - chartMargin.left - chartMargin.right)
    const reservedRightPx = Math.max(
      0,
      heroLegendRenderedWidth
      + positionedLegendLayout.labelGapPx
      + positionedLegendLayout.rightInsetPx,
    )

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
    heroLegendRenderedWidth,
    positionedLegendLayout,
    usesPositionedSeriesLegend,
  ])

  const heroLegendPositionedEntries = useMemo(
    () => {
      if (!canRenderPositionedSeriesLegend || heroLegendSeriesWithValues.length === 0 || chartData.length === 0) {
        return [] as Array<{
          key: string
          name: string
          color: string
          value: number
          left: number
          top: number
          width: number
          height: number
        }>
      }

      const firstPoint = chartData[0]
      const lastPoint = chartData.at(-1)
      if (!firstPoint || !lastPoint) {
        return []
      }

      const firstTimestamp = firstPoint.date.getTime()
      const lastTimestamp = lastPoint.date.getTime()
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

      const xSpan = Math.max(1, domainEnd - domainStart)
      const plotWidth = Math.max(1, chartWidth - chartMargin.left - chartMargin.right)
      const plotHeight = Math.max(1, chartHeight - chartMargin.top - chartMargin.bottom)
      const yAxisMinTicks = Math.max(3, Math.min(5, Math.round(plotHeight / 56)))
      const chartTop = chartMargin.top
      const chartBottom = chartMargin.top + plotHeight
      const dotX = chartMargin.left + ((hoveredTimestamp - domainStart) / xSpan) * plotWidth
      const plotLeft = chartMargin.left
      const plotRight = chartWidth - chartMargin.right
      const availableFullWidth = plotRight - plotLeft - positionedLegendLayout.rightInsetPx
      const effectiveLabelWidth = Math.max(0, Math.min(heroLegendRenderedWidth, availableFullWidth))
      const maxLeft = plotRight - effectiveLabelWidth - positionedLegendLayout.rightInsetPx
      const labelLeft = Math.max(plotLeft, Math.min(maxLeft, dotX + positionedLegendLayout.labelGapPx))
      const availableLabelWidth = Math.max(1, chartWidth - labelLeft - positionedLegendLayout.rightInsetPx)

      const labelMeasureContext = typeof document !== 'undefined'
        ? document.createElement('canvas').getContext('2d')
        : null
      if (labelMeasureContext) {
        labelMeasureContext.font = positionedLegendLayout.nameFont
      }

      const yBounds = calculateYAxisBounds(chartData, chartSeries, yAxisMinTicks, 6)
      const ySpan = Math.max(1, yBounds.max - yBounds.min)
      const preferredEntries = heroLegendSeriesWithValues.map((entry) => {
        const clampedValue = Math.max(yBounds.min, Math.min(yBounds.max, entry.value))
        const dotY = chartMargin.top + ((yBounds.max - clampedValue) / ySpan) * plotHeight
        const normalizedName = entry.name.trim()
        const measuredNameWidth = normalizedName
          ? (labelMeasureContext?.measureText(normalizedName).width ?? normalizedName.length * 7)
          : 0
        const wrappedNameLineCount = Math.max(1, Math.ceil(measuredNameWidth / availableLabelWidth))
        const labelHeight = Math.max(
          positionedLegendLayout.minHeightPx,
          (wrappedNameLineCount * positionedLegendLayout.nameLineHeightPx) + positionedLegendLayout.valueLineHeightPx,
        )
        const anchorOffset = labelHeight / 2
        const preferredTop = dotY - anchorOffset
        const maxTopForEntry = chartBottom - labelHeight

        return {
          ...entry,
          dotY,
          left: labelLeft,
          width: effectiveLabelWidth,
          height: labelHeight,
          labelHeight,
          preferredTop: Math.max(chartTop, Math.min(maxTopForEntry, preferredTop)),
        }
      })

      const sortedByPreferredTop = [...preferredEntries]
        .sort((left, right) => left.preferredTop - right.preferredTop)

      const stacked: Array<(typeof sortedByPreferredTop)[number] & { top: number }> = []
      sortedByPreferredTop.forEach((entry, index) => {
        const previousBottom = index > 0
          ? (stacked[index - 1]!.top + stacked[index - 1]!.labelHeight)
          : null
        const top = previousBottom == null
          ? entry.preferredTop
          : Math.max(entry.preferredTop, previousBottom + positionedLegendLayout.verticalGapPx)
        const maxTopForEntry = chartBottom - entry.labelHeight
        stacked.push({ ...entry, top: Math.max(chartTop, Math.min(maxTopForEntry, top)) })
      })

      for (let index = stacked.length - 2; index >= 0; index -= 1) {
        const entry = stacked[index]!
        const next = stacked[index + 1]!
        const maxTopForEntry = chartBottom - entry.labelHeight
        const highestTopAllowedByNext = next.top - positionedLegendLayout.verticalGapPx - entry.labelHeight
        entry.top = Math.max(
          chartTop,
          Math.min(maxTopForEntry, Math.min(entry.top, highestTopAllowedByNext)),
        )
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
      heroLegendRenderedWidth,
      chartMargin.bottom,
      chartMargin.left,
      chartMargin.right,
      chartMargin.top,
      chartSeries,
      chartWidth,
      chartXDomain,
      cursorSnapshot?.date,
      heroLegendSeriesWithValues,
      canRenderPositionedSeriesLegend,
      positionedLegendLayout,
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

  return {
    heroLegendRenderedWidth,
    chartXDomain,
    heroLegendSeriesWithValues,
    heroLegendPositionedEntries,
    legendSeriesWithValues,
  }
}

export function useSportsGameGraphInteractionState(defaultTimeRange: (typeof TIME_RANGES)[number]) {
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const [activeTimeRange, setActiveTimeRange] = useState<(typeof TIME_RANGES)[number]>(defaultTimeRange)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)

  return {
    cursorSnapshot,
    setCursorSnapshot,
    activeTimeRange,
    setActiveTimeRange,
    exportDialogOpen,
    setExportDialogOpen,
    embedDialogOpen,
    setEmbedDialogOpen,
  }
}

export function useSportsGameGraphTradeFlow({
  isSportsEventHeroVariant,
  tradeFlowSeriesByTokenId,
}: {
  isSportsEventHeroVariant: boolean
  tradeFlowSeriesByTokenId: Map<string, { color: string }>
}) {
  const [tradeFlowItems, setTradeFlowItems] = useState<SportsTradeFlowLabelItem[]>([])
  const tradeFlowIdRef = useRef(0)
  const hasTradeFlowLabels = tradeFlowItems.length > 0

  useOptionalMarketChannelSubscription((payload) => {
    if (!isSportsEventHeroVariant || !payload) {
      return
    }

    if (payload.event_type !== 'last_trade_price') {
      return
    }

    const assetId = String(payload.asset_id ?? '')
    if (!assetId) {
      return
    }

    const matchedSeries = tradeFlowSeriesByTokenId.get(assetId)
    if (!matchedSeries) {
      return
    }

    const price = Number(payload.price)
    const size = Number(payload.size)
    const label = buildTradeFlowLabel(price, size)
    if (!label) {
      return
    }

    const createdAt = Date.now()
    const id = String(tradeFlowIdRef.current)
    tradeFlowIdRef.current += 1

    setTradeFlowItems((previous) => {
      const next = [...previous, { id, label, color: matchedSeries.color, createdAt }]
      return trimTradeFlowItems(pruneTradeFlowItems(next, createdAt))
    })
  })

  useEffect(function pruneExpiredTradeFlowItems() {
    if (!isSportsEventHeroVariant || !hasTradeFlowLabels) {
      return undefined
    }

    const interval = window.setInterval(() => {
      const now = Date.now()
      setTradeFlowItems((previous) => {
        const next = pruneTradeFlowItems(previous, now)
        if (next.length === previous.length) {
          return previous
        }
        return next
      })
    }, TRADE_FLOW_CLEANUP_INTERVAL_MS)

    return function clearTradeFlowPruneInterval() {
      window.clearInterval(interval)
    }
  }, [hasTradeFlowLabels, isSportsEventHeroVariant])

  return { tradeFlowItems, hasTradeFlowLabels }
}

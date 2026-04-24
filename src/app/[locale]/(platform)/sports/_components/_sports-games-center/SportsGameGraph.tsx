'use client'

import type { SportsGameGraphVariant, SportsGamesMarketType } from './sports-games-center-types'
import type { SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { PredictionChartProps } from '@/types/PredictionChartTypes'
import dynamic from 'next/dynamic'
import { useCallback, useState, useSyncExternalStore } from 'react'
import EventChartControls from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartControls'
import EventChartEmbedDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartEmbedDialog'
import EventChartExportDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartExportDialog'
import { TIME_RANGES } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { useWindowSize } from '@/hooks/useWindowSize'
import { cn } from '@/lib/utils'
import { tradeFlowTextStrokeStyle } from './sports-games-center-constants'
import {
  useSportsGameGraphChartDimensions,
  useSportsGameGraphChartSettings,
  useSportsGameGraphHeroLegend,
  useSportsGameGraphHistory,
  useSportsGameGraphInteractionState,
  useSportsGameGraphSeries,
  useSportsGameGraphTradeFlow,
} from './useSportsGameGraph'

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false },
)

function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!element) {
      return function noopElementWidthSubscription() {}
    }

    function notifyElementWidthChange() {
      onStoreChange()
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', notifyElementWidthChange)

      return function removeElementWidthResizeListener() {
        window.removeEventListener('resize', notifyElementWidthChange)
      }
    }

    const observer = new ResizeObserver(notifyElementWidthChange)
    observer.observe(element)

    return function disconnectElementWidthObserver() {
      observer.disconnect()
    }
  }, [element])

  const getSnapshot = useCallback(() => {
    if (!element) {
      return undefined
    }

    const nextWidth = Math.round(element.getBoundingClientRect().width)
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
      return undefined
    }

    return nextWidth
  }, [element])

  const width = useSyncExternalStore(subscribe, getSnapshot, () => undefined)

  const ref = useCallback((node: T | null) => {
    setElement(currentElement => currentElement === node ? currentElement : node)
  }, [])

  return [ref, width] as const
}

export default function SportsGameGraph({
  card,
  selectedMarketType,
  selectedConditionId,
  defaultTimeRange = '1W',
  variant = 'default',
}: {
  card: SportsGamesCard
  selectedMarketType: SportsGamesMarketType
  selectedConditionId: string | null
  defaultTimeRange?: (typeof TIME_RANGES)[number]
  variant?: SportsGameGraphVariant
}) {
  const { width: windowWidth } = useWindowSize()
  const [chartContainerRef, chartContainerWidth] = useElementWidth<HTMLDivElement>()
  const {
    cursorSnapshot,
    setCursorSnapshot,
    activeTimeRange,
    setActiveTimeRange,
    exportDialogOpen,
    setExportDialogOpen,
    embedDialogOpen,
    setEmbedDialogOpen,
  } = useSportsGameGraphInteractionState(defaultTimeRange)
  const isSecondaryMarketGraph = selectedMarketType === 'spread' || selectedMarketType === 'total'

  const [chartSettings, setChartSettings] = useSportsGameGraphChartSettings()

  const {
    isSportsEventHeroVariant,
    usesPositionedSeriesLegend,
    canRenderPositionedSeriesLegend,
    positionedLegendLayout,
    chartHeight,
    chartMargin,
    chartWidth,
  } = useSportsGameGraphChartDimensions({
    containerWidth: chartContainerWidth,
    windowWidth,
    variant,
  })

  const { graphSeriesTargets, tradeFlowSeriesByTokenId, marketTargets, chartSeries } = useSportsGameGraphSeries({
    card,
    selectedConditionId,
    isSecondaryMarketGraph,
    isSportsEventHeroVariant,
  })

  const { chartData, latestSnapshot, leadingGapStart } = useSportsGameGraphHistory({
    card,
    marketTargets,
    activeTimeRange,
    chartSeries,
    graphSeriesTargets,
    isSecondaryMarketGraph,
  })

  const {
    chartXDomain,
    heroLegendPositionedEntries,
    legendSeriesWithValues,
  } = useSportsGameGraphHeroLegend({
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
  })

  const { tradeFlowItems, hasTradeFlowLabels } = useSportsGameGraphTradeFlow({
    isSportsEventHeroVariant,
    tradeFlowSeriesByTokenId,
  })

  const legendContent = !isSecondaryMarketGraph && !usesPositionedSeriesLegend && legendSeriesWithValues.length > 0
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
      <div style={usesPositionedSeriesLegend ? { minHeight: `${chartHeight + 56}px` } : undefined}>
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
            showLegend={!isSecondaryMarketGraph && !usesPositionedSeriesLegend}
            showTooltipSeriesLabels={!usesPositionedSeriesLegend}
            disableCursorSplit={false}
            clampCursorToDataExtent={usesPositionedSeriesLegend}
            markerOuterRadius={usesPositionedSeriesLegend ? (isSportsEventHeroVariant ? 15 : 10) : undefined}
            markerInnerRadius={usesPositionedSeriesLegend ? (isSportsEventHeroVariant ? 5.2 : 4.2) : undefined}
            markerPulseStyle={usesPositionedSeriesLegend ? (isSportsEventHeroVariant ? 'filled' : 'ring') : undefined}
            lineCurve="monotoneX"
            tooltipValueFormatter={value => `${Math.round(value)}%`}
            autoscale={chartSettings.autoscale}
            showXAxis={chartSettings.xAxis}
            showYAxis={chartSettings.yAxis}
            showHorizontalGrid={chartSettings.horizontalGrid}
            showVerticalGrid={chartSettings.verticalGrid}
            showAnnotations={chartSettings.annotations}
            leadingGapStart={leadingGapStart}
          />

          {canRenderPositionedSeriesLegend && heroLegendPositionedEntries.length > 0 && (
            <div
              className={cn(
                'pointer-events-none absolute inset-0',
                isSportsEventHeroVariant ? 'overflow-visible' : 'overflow-hidden',
              )}
            >
              {heroLegendPositionedEntries.map(entry => (
                <div
                  key={entry.key}
                  className={cn(
                    'absolute flex flex-col',
                    isSportsEventHeroVariant ? 'overflow-visible' : 'overflow-hidden',
                  )}
                  style={{
                    top: `${entry.top}px`,
                    left: `${(entry.left / chartWidth) * 100}%`,
                    width: `${(entry.width / chartWidth) * 100}%`,
                    height: `${entry.height}px`,
                  }}
                >
                  <div
                    className={cn(
                      isSportsEventHeroVariant ? 'whitespace-nowrap' : 'truncate',
                      isSportsEventHeroVariant
                        ? undefined
                        : 'text-[13px] leading-snug font-medium tracking-tight',
                    )}
                    style={{
                      color: entry.color,
                      lineHeight: isSportsEventHeroVariant
                        ? `${positionedLegendLayout.nameLineHeightPx}px`
                        : undefined,
                      font: isSportsEventHeroVariant
                        ? positionedLegendLayout.nameFont
                        : undefined,
                      letterSpacing: isSportsEventHeroVariant ? '0' : undefined,
                      margin: 0,
                    }}
                  >
                    {entry.name}
                  </div>
                  <div
                    className={cn(
                      'whitespace-nowrap tabular-nums',
                      isSportsEventHeroVariant
                        ? undefined
                        : 'text-2xl/tight',
                    )}
                    style={{
                      color: entry.color,
                      lineHeight: isSportsEventHeroVariant
                        ? `${positionedLegendLayout.valueLineHeightPx}px`
                        : undefined,
                      font: isSportsEventHeroVariant
                        ? positionedLegendLayout.valueFont
                        : undefined,
                      letterSpacing: isSportsEventHeroVariant ? '0' : undefined,
                      marginTop: `${Math.max(0, positionedLegendLayout.nameLineHeightPx - 14)}px`,
                      marginBottom: 0,
                    }}
                  >
                    {`${Math.round(entry.value)}%`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isSportsEventHeroVariant && hasTradeFlowLabels && (
            <div className={`
              pointer-events-none absolute bottom-6 left-4 flex flex-col gap-1 text-sm font-semibold tabular-nums
            `}
            >
              {tradeFlowItems.map(item => (
                <span
                  key={item.id}
                  className="animate-trade-flow-rise"
                  style={{
                    ...tradeFlowTextStrokeStyle,
                    color: item.color,
                  }}
                >
                  +
                  {item.label}
                </span>
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

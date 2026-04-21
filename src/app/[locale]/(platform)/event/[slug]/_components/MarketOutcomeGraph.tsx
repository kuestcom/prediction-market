'use client'

import type { ChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartControls'
import type { TimeRange } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { Market, Outcome } from '@/types'
import type { PredictionChartCursorSnapshot, PredictionChartProps } from '@/types/PredictionChartTypes'
import { useQuery } from '@tanstack/react-query'
import { Clock3Icon, SparkleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import EventChartControls from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartControls'
import EventChartEmbedDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartEmbedDialog'
import EventChartExportDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartExportDialog'
import EventChartHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartHeader'
import EventChartLayout from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartLayout'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import {
  buildMarketTargets,
  TIME_RANGES,
  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import {
  getStoredChartSettingsServerSnapshot,
  loadStoredChartSettings,
  storeChartSettings,
  subscribeToChartSettings,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/chartSettingsStorage'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { useWindowSize } from '@/hooks/useWindowSize'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { isMarketNew } from '@/lib/utils'

interface MarketOutcomeGraphProps {
  market: Market
  outcome: Outcome
  allMarkets: Market[]
  currentTimestamp: number | null
  eventCreatedAt: string
  isMobile: boolean
}

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <Skeleton className="h-79.5 w-full" /> },
)
const YES_SERIES_COLOR = 'var(--primary)'
const NO_SERIES_COLOR = 'var(--no)'

function useChartSettingsStore() {
  const chartSettings = useSyncExternalStore(
    subscribeToChartSettings,
    loadStoredChartSettings,
    getStoredChartSettingsServerSnapshot,
  )

  const handleChartSettingsChange = useCallback((
    nextSettings: ChartSettings | ((current: ChartSettings) => ChartSettings),
  ) => {
    const resolvedSettings = typeof nextSettings === 'function'
      ? nextSettings(chartSettings)
      : nextSettings
    storeChartSettings(resolvedSettings)
  }, [chartSettings])

  return { chartSettings, handleChartSettingsChange }
}

function useOutcomeSelection({
  market,
  outcome,
}: {
  market: Market
  outcome: Outcome
}) {
  const [activeOutcomeOverride, setActiveOutcomeOverride] = useState<{ key: string, index: number } | null>(null)

  const activeOutcomeKey = outcome.token_id || `${market.condition_id}:${outcome.outcome_index}`
  const activeOutcomeIndex = useMemo(() => {
    if (activeOutcomeOverride?.key === activeOutcomeKey) {
      return activeOutcomeOverride.index
    }

    return outcome.outcome_index
  }, [activeOutcomeKey, activeOutcomeOverride, outcome.outcome_index])

  const activeOutcome = useMemo(() => {
    return market.outcomes.find(item => item.outcome_index === activeOutcomeIndex) ?? outcome
  }, [market.outcomes, activeOutcomeIndex, outcome])

  const oppositeOutcomeIndex = activeOutcomeIndex === OUTCOME_INDEX.YES
    ? OUTCOME_INDEX.NO
    : OUTCOME_INDEX.YES

  const oppositeOutcome = useMemo(() => {
    return market.outcomes.find(item => item.outcome_index === oppositeOutcomeIndex) ?? activeOutcome
  }, [market.outcomes, oppositeOutcomeIndex, activeOutcome])

  const handleShuffleOutcome = useCallback(() => {
    setActiveOutcomeOverride({
      key: activeOutcomeKey,
      index: oppositeOutcome.outcome_index,
    })
  }, [activeOutcomeKey, oppositeOutcome.outcome_index])

  return { activeOutcomeIndex, activeOutcome, oppositeOutcome, handleShuffleOutcome }
}

function useChartCursor(chartSignature: string) {
  const [cursorState, setCursorState] = useState<{ key: string, snapshot: PredictionChartCursorSnapshot | null }>({
    key: '',
    snapshot: null,
  })

  const cursorSnapshot = cursorState.key === chartSignature ? cursorState.snapshot : null

  const handleCursorDataChange = useCallback((
    nextSnapshot: PredictionChartCursorSnapshot | null,
  ) => {
    setCursorState({ key: chartSignature, snapshot: nextSnapshot })
  }, [chartSignature])

  return { cursorSnapshot, handleCursorDataChange }
}

function useChartDataValues({
  normalizedHistory,
  conditionId,
  activeOutcomeIndex,
  activeTimeRange,
  showBothOutcomes,
  activeSeriesKey,
  activeOutcome,
  yesOutcomeLabel,
  noOutcomeLabel,
  normalizeOutcomeLabel,
}: {
  normalizedHistory: Array<Record<string, number | Date> & { date: Date }>
  conditionId: string
  activeOutcomeIndex: number
  activeTimeRange: TimeRange
  showBothOutcomes: boolean
  activeSeriesKey: 'yes' | 'no' | 'value'
  activeOutcome: Outcome
  yesOutcomeLabel: string
  noOutcomeLabel: string
  normalizeOutcomeLabel: (value: string | null | undefined) => string | undefined
}) {
  const chartData = useMemo(() => {
    return showBothOutcomes
      ? buildComparisonChartData(normalizedHistory, conditionId)
      : buildChartData(normalizedHistory, conditionId, activeOutcomeIndex)
  }, [normalizedHistory, conditionId, activeOutcomeIndex, showBothOutcomes])

  const series = useMemo(() => {
    return showBothOutcomes
      ? [
          { key: 'yes', name: yesOutcomeLabel, color: YES_SERIES_COLOR },
          { key: 'no', name: noOutcomeLabel, color: NO_SERIES_COLOR },
        ]
      : [{
          key: 'value',
          name: normalizeOutcomeLabel(activeOutcome.outcome_text) ?? activeOutcome.outcome_text,
          color: activeOutcome.outcome_index === OUTCOME_INDEX.NO ? NO_SERIES_COLOR : YES_SERIES_COLOR,
        }]
  }, [activeOutcome.outcome_index, activeOutcome.outcome_text, showBothOutcomes, yesOutcomeLabel, noOutcomeLabel, normalizeOutcomeLabel])

  const chartSignature = useMemo(() => {
    return `${conditionId}:${activeOutcomeIndex}:${activeTimeRange}:${showBothOutcomes ? 'both' : 'single'}`
  }, [conditionId, activeOutcomeIndex, activeTimeRange, showBothOutcomes])

  const latestValue = useMemo(() => {
    for (let index = chartData.length - 1; index >= 0; index -= 1) {
      const point = chartData[index]
      if (!point) {
        continue
      }

      const value = showBothOutcomes
        ? (activeSeriesKey === 'yes' && 'yes' in point
            ? point.yes
            : 'no' in point
              ? point.no
              : undefined)
        : ('value' in point ? point.value : undefined)

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, activeSeriesKey, showBothOutcomes])

  const baselineValue = useMemo(() => {
    for (const point of chartData) {
      const value = showBothOutcomes
        ? (activeSeriesKey === 'yes' && 'yes' in point
            ? point.yes
            : 'no' in point
              ? point.no
              : undefined)
        : ('value' in point ? point.value : undefined)

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, activeSeriesKey, showBothOutcomes])

  return { chartData, series, chartSignature, latestValue, baselineValue }
}

export default function MarketOutcomeGraph({
  market,
  outcome,
  allMarkets,
  currentTimestamp,
  eventCreatedAt,
  isMobile,
}: MarketOutcomeGraphProps) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('ALL')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const marketTargets = useMemo(() => buildMarketTargets([market]), [market])
  const { width: windowWidth } = useWindowSize()
  const chartWidth = isMobile ? ((windowWidth || 400) * 0.84) : Math.min((windowWidth ?? 1440) * 0.55, 900)
  const { chartSettings, handleChartSettingsChange } = useChartSettingsStore()
  const { activeOutcomeIndex, activeOutcome, oppositeOutcome, handleShuffleOutcome } = useOutcomeSelection({ market, outcome })
  const showOutcomeSwitch = market.outcomes.length > 1
    && oppositeOutcome.outcome_index !== activeOutcome.outcome_index
  const showBothOutcomes = chartSettings.bothOutcomes && showOutcomeSwitch
  const yesOutcomeLabel = normalizeOutcomeLabel(
    market.outcomes.find(item => item.outcome_index === OUTCOME_INDEX.YES)?.outcome_text,
  ) ?? t('Yes')
  const noOutcomeLabel = normalizeOutcomeLabel(
    market.outcomes.find(item => item.outcome_index === OUTCOME_INDEX.NO)?.outcome_text,
  ) ?? t('No')

  const {
    normalizedHistory,
    latestRawPrices,
  } = useEventPriceHistory({
    eventId: market.event_id,
    range: activeTimeRange,
    targets: marketTargets,
    eventCreatedAt,
  })
  const marketQuotesByMarket = useEventMarketQuotes(marketTargets)
  const liveYesChance = useMemo(() => {
    const quote = marketQuotesByMarket[market.condition_id]
    const lastTrade = latestRawPrices[market.condition_id]
    const displayPrice = resolveDisplayPrice({
      bid: quote?.bid ?? null,
      ask: quote?.ask ?? null,
      midpoint: quote?.mid ?? null,
      lastTrade,
    })

    return typeof displayPrice === 'number' && Number.isFinite(displayPrice)
      ? displayPrice * 100
      : null
  }, [latestRawPrices, market.condition_id, marketQuotesByMarket])
  const normalizedHistoryForChart = useMemo(() => {
    if (typeof liveYesChance !== 'number' || !Number.isFinite(liveYesChance)) {
      return normalizedHistory
    }

    const clampedLiveYesChance = Math.max(0, Math.min(100, liveYesChance))
    const fallbackTimestamp = normalizedHistory.at(-1)?.date.getTime()
    if (!Number.isFinite(currentTimestamp) && !Number.isFinite(fallbackTimestamp)) {
      return normalizedHistory
    }
    const nextTimestamp = Number.isFinite(currentTimestamp)
      ? (currentTimestamp as number)
      : (fallbackTimestamp as number)
    const nextDate = new Date(nextTimestamp)

    if (normalizedHistory.length === 0) {
      return [{
        date: nextDate,
        [market.condition_id]: clampedLiveYesChance,
      }]
    }

    const lastPoint = normalizedHistory.at(-1)
    if (!lastPoint) {
      return normalizedHistory
    }

    const lastTimestamp = lastPoint.date.getTime()
    const lastPointValue = lastPoint[market.condition_id]
    const hasSameLatestValue = (
      typeof lastPointValue === 'number'
      && Number.isFinite(lastPointValue)
      && Math.abs(lastPointValue - clampedLiveYesChance) < 0.0001
    )

    if (hasSameLatestValue) {
      return normalizedHistory
    }

    if (Number.isFinite(lastTimestamp) && lastTimestamp >= nextTimestamp) {
      return [
        ...normalizedHistory.slice(0, -1),
        {
          ...lastPoint,
          [market.condition_id]: clampedLiveYesChance,
        },
      ]
    }

    return [
      ...normalizedHistory,
      {
        date: nextDate,
        [market.condition_id]: clampedLiveYesChance,
      },
    ]
  }, [currentTimestamp, liveYesChance, market.condition_id, normalizedHistory])
  const leadingGapStart = normalizedHistoryForChart[0]?.date ?? null

  const activeSeriesKey: 'yes' | 'no' | 'value' = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? 'no' : 'yes')
    : 'value'

  const { chartData, series, chartSignature, latestValue, baselineValue } = useChartDataValues({
    normalizedHistory: normalizedHistoryForChart,
    conditionId: market.condition_id,
    activeOutcomeIndex,
    activeTimeRange,
    showBothOutcomes,
    activeSeriesKey,
    activeOutcome,
    yesOutcomeLabel,
    noOutcomeLabel,
    normalizeOutcomeLabel,
  })
  const { cursorSnapshot, handleCursorDataChange } = useChartCursor(chartSignature)
  const hasChartData = chartData.length > 0
  const watermark = useMemo(
    () => ({
      iconSvg: site.logoSvg,
      label: site.name,
    }),
    [site.logoSvg, site.name],
  )

  const primarySeriesColor = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? NO_SERIES_COLOR : YES_SERIES_COLOR)
    : (series[0]?.color ?? YES_SERIES_COLOR)
  const liveActiveChance = useMemo(() => {
    if (typeof liveYesChance !== 'number' || !Number.isFinite(liveYesChance)) {
      return null
    }

    const normalizedYesChance = Math.max(0, Math.min(100, liveYesChance))
    if (showBothOutcomes) {
      return activeSeriesKey === 'no'
        ? Math.max(0, Math.min(100, 100 - normalizedYesChance))
        : normalizedYesChance
    }

    return activeOutcomeIndex === OUTCOME_INDEX.NO
      ? Math.max(0, Math.min(100, 100 - normalizedYesChance))
      : normalizedYesChance
  }, [activeOutcomeIndex, activeSeriesKey, liveYesChance, showBothOutcomes])
  const hoveredValue = cursorSnapshot?.values?.[activeSeriesKey]
  const resolvedValue = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
    ? hoveredValue
    : (liveActiveChance ?? latestValue)
  const currentValue = resolvedValue

  return (
    <>
      <EventChartLayout
        header={hasChartData
          ? (
              <EventChartHeader
                isSingleMarket
                activeOutcomeIndex={activeOutcome.outcome_index as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO}
                activeOutcomeLabel={normalizeOutcomeLabel(activeOutcome.outcome_text) ?? activeOutcome.outcome_text}
                primarySeriesColor={primarySeriesColor}
                yesChanceValue={typeof resolvedValue === 'number' ? resolvedValue : null}
                effectiveBaselineYesChance={typeof baselineValue === 'number' ? baselineValue : null}
                effectiveCurrentYesChance={typeof currentValue === 'number' ? currentValue : null}
                watermark={watermark}
              />
            )
          : null}
        chart={hasChartData
          ? (
              <PredictionChart
                data={chartData}
                series={series}
                width={chartWidth}
                height={318}
                margin={{ top: 20, right: 40, bottom: 48, left: 0 }}
                dataSignature={chartSignature}
                onCursorDataChange={handleCursorDataChange}
                xAxisTickCount={isMobile ? 2 : 4}
                autoscale={chartSettings.autoscale}
                showXAxis={chartSettings.xAxis}
                showYAxis={chartSettings.yAxis}
                showHorizontalGrid={chartSettings.horizontalGrid}
                showVerticalGrid={chartSettings.verticalGrid}
                showAnnotations={chartSettings.annotations}
                leadingGapStart={leadingGapStart}
                legendContent={null}
                showLegend={false}
                watermark={undefined}
                lineCurve="monotoneX"
              />
            )
          : (
              <div className="flex min-h-16 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Price history is unavailable for this outcome.
              </div>
            )}
        controls={(
          <div className="mt-3 flex flex-wrap items-center gap-3 pb-2">
            <MarketOutcomeMetaInformation market={market} currentTimestamp={currentTimestamp} />
            {hasChartData && (
              <div className="ml-auto">
                <EventChartControls
                  timeRanges={TIME_RANGES}
                  activeTimeRange={activeTimeRange}
                  onTimeRangeChange={setActiveTimeRange}
                  showOutcomeSwitch={showOutcomeSwitch}
                  oppositeOutcomeLabel={normalizeOutcomeLabel(oppositeOutcome.outcome_text) ?? oppositeOutcome.outcome_text}
                  onShuffle={handleShuffleOutcome}
                  settings={chartSettings}
                  onSettingsChange={handleChartSettingsChange}
                  onExportData={() => setExportDialogOpen(true)}
                  onEmbed={() => setEmbedDialogOpen(true)}
                />
              </div>
            )}
          </div>
        )}
      />
      <EventChartExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        eventCreatedAt={eventCreatedAt}
        markets={allMarkets}
        isMultiMarket={allMarkets.length > 1}
      />
      <EventChartEmbedDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        markets={allMarkets}
        initialMarketId={market.condition_id}
      />
    </>
  )
}

function buildChartData(
  normalizedHistory: Array<Record<string, number | Date> & { date: Date }>,
  conditionId: string,
  outcomeIndex: number,
) {
  if (!normalizedHistory.length) {
    return []
  }

  return normalizedHistory
    .map((point) => {
      const value = point[conditionId]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null
      }
      const resolvedValue = outcomeIndex === OUTCOME_INDEX.YES
        ? value
        : Math.max(0, 100 - value)
      return {
        date: point.date,
        value: resolvedValue,
      }
    })
    .filter((entry): entry is { date: Date, value: number } => entry !== null)
}

function MarketOutcomeMetaInformation({ market, currentTimestamp }: { market: Market, currentTimestamp: number | null }) {
  const t = useExtracted()
  const volumeRequestPayload = useMemo(() => {
    const tokenIds = (market.outcomes ?? [])
      .map(outcome => outcome.token_id)
      .filter(Boolean)
      .slice(0, 2)

    if (!market.condition_id || tokenIds.length < 2) {
      return { conditions: [], signature: '' }
    }

    const signature = `${market.condition_id}:${tokenIds.join(':')}`
    return {
      conditions: [{ condition_id: market.condition_id, token_ids: tokenIds as [string, string] }],
      signature,
    }
  }, [market.condition_id, market.outcomes])

  const { data: volumeFromApi } = useQuery({
    queryKey: ['market-volumes', market.condition_id, volumeRequestPayload.signature],
    enabled: volumeRequestPayload.conditions.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const response = await fetch(`${process.env.CLOB_URL}/data/volumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          include_24h: false,
          conditions: volumeRequestPayload.conditions,
        }),
      })

      const payload = await response.json() as Array<{
        condition_id: string
        status: number
        volume?: string
      }>

      return payload
        .filter(entry => entry?.status === 200)
        .reduce((total, entry) => {
          const numeric = Number(entry.volume ?? 0)
          return Number.isFinite(numeric) ? total + numeric : total
        }, 0)
    },
  })

  const resolvedVolume = useMemo(() => {
    if (typeof volumeFromApi === 'number' && Number.isFinite(volumeFromApi)) {
      return volumeFromApi
    }
    return market.volume
  }, [market.volume, volumeFromApi])

  const shouldShowNew = isMarketNew(market.created_at, undefined, currentTimestamp)
  const formattedVolume = Number.isFinite(resolvedVolume)
    ? (resolvedVolume || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
  const volumeLabel = `$${formattedVolume} Vol.`
  const expiryTooltip = t.rich(
    'This is estimated end date.<br></br>See rules below for specific resolution details.',
    { br: () => ' ' },
  )
  const parsedEndTimestamp = market.end_time ? Date.parse(market.end_time) : Number.NaN
  const expiryTimestamp = Number.isFinite(parsedEndTimestamp) ? parsedEndTimestamp : null
  const remainingDays = expiryTimestamp !== null && currentTimestamp !== null
    ? Math.max(0, Math.ceil((expiryTimestamp - currentTimestamp) / (24 * 60 * 60 * 1000)))
    : null
  const remainingLabel = remainingDays !== null ? t('In {days} days', { days: String(remainingDays) }) : ''

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {shouldShowNew && (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <SparkleIcon className="size-3.5 fill-current" stroke="currentColor" fill="currentColor" />
          <span>New</span>
        </span>
      )}
      {shouldShowNew && (
        <span className="mx-1.5 h-4 w-px bg-muted-foreground/40" aria-hidden="true" />
      )}
      <div className="flex items-center gap-2 text-foreground">
        <span className="text-sm font-semibold text-foreground">{volumeLabel}</span>
      </div>
      {expiryTimestamp !== null && (
        <span className="mx-1.5 h-4 w-px bg-muted-foreground/40" aria-hidden="true" />
      )}
      {expiryTimestamp !== null && (
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1.5 text-sm/tight font-semibold text-muted-foreground">
              <Clock3Icon className="size-4 text-muted-foreground" strokeWidth={2.5} />
              <span>{formatDate(expiryTimestamp)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64 text-left">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{remainingLabel}</span>
              <span className="text-xs text-foreground">{expiryTooltip}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function buildComparisonChartData(
  normalizedHistory: Array<Record<string, number | Date> & { date: Date }>,
  conditionId: string,
) {
  if (!normalizedHistory.length) {
    return []
  }

  return normalizedHistory
    .map((point) => {
      const value = point[conditionId]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null
      }
      return {
        date: point.date,
        yes: value,
        no: Math.max(0, 100 - value),
      }
    })
    .filter((entry): entry is { date: Date, yes: number, no: number } => entry !== null)
}

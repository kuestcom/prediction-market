'use client'

import type { TimeRange } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { Market, Outcome } from '@/types'
import type { PredictionChartCursorSnapshot, PredictionChartProps } from '@/types/PredictionChartTypes'
import { useQuery } from '@tanstack/react-query'
import { Clock3Icon, SparkleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import EventChartControls, { defaultChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartControls'
import EventChartEmbedDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartEmbedDialog'
import EventChartExportDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartExportDialog'
import EventChartHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartHeader'
import EventChartLayout from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartLayout'
import {
  buildMarketTargets,
  TIME_RANGES,
  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { loadStoredChartSettings, storeChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_utils/chartSettingsStorage'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useWindowSize } from '@/hooks/useWindowSize'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { isMarketNew, svgLogo } from '@/lib/utils'

interface MarketOutcomeGraphProps {
  market: Market
  outcome: Outcome
  allMarkets: Market[]
  eventCreatedAt: string
  isMobile: boolean
}

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <Skeleton className="h-79.5 w-full" /> },
)

export default function MarketOutcomeGraph({ market, outcome, allMarkets, eventCreatedAt, isMobile }: MarketOutcomeGraphProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('ALL')
  const [activeOutcomeIndex, setActiveOutcomeIndex] = useState(outcome.outcome_index)
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const [chartSettings, setChartSettings] = useState(() => ({ ...defaultChartSettings }))
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const marketTargets = useMemo(() => buildMarketTargets(allMarkets), [allMarkets])
  const { width: windowWidth } = useWindowSize()
  const chartWidth = isMobile ? ((windowWidth || 400) * 0.84) : Math.min((windowWidth ?? 1440) * 0.55, 900)

  useEffect(() => {
    setActiveOutcomeIndex(outcome.outcome_index)
    setCursorSnapshot(null)
  }, [outcome.token_id, outcome.outcome_index])

  useEffect(() => {
    setCursorSnapshot(null)
  }, [activeTimeRange, activeOutcomeIndex, chartSettings.bothOutcomes])

  useEffect(() => {
    setChartSettings(loadStoredChartSettings())
    setHasLoadedSettings(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedSettings) {
      return
    }
    storeChartSettings(chartSettings)
  }, [chartSettings, hasLoadedSettings])

  const activeOutcome = useMemo(
    () => market.outcomes.find(item => item.outcome_index === activeOutcomeIndex) ?? outcome,
    [market.outcomes, activeOutcomeIndex, outcome],
  )
  const oppositeOutcomeIndex = activeOutcomeIndex === OUTCOME_INDEX.YES
    ? OUTCOME_INDEX.NO
    : OUTCOME_INDEX.YES
  const oppositeOutcome = useMemo(
    () => market.outcomes.find(item => item.outcome_index === oppositeOutcomeIndex) ?? activeOutcome,
    [market.outcomes, oppositeOutcomeIndex, activeOutcome],
  )
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
  } = useEventPriceHistory({
    eventId: market.event_id,
    range: activeTimeRange,
    targets: marketTargets,
    eventCreatedAt,
  })

  const chartData = useMemo(
    () => (showBothOutcomes
      ? buildComparisonChartData(normalizedHistory, market.condition_id)
      : buildChartData(normalizedHistory, market.condition_id, activeOutcomeIndex)),
    [normalizedHistory, market.condition_id, activeOutcomeIndex, showBothOutcomes],
  )
  const leadingGapStart = normalizedHistory[0]?.date ?? null

  const series = useMemo(
    () => (showBothOutcomes
      ? [
          { key: 'yes', name: yesOutcomeLabel, color: '#2D9CDB' },
          { key: 'no', name: noOutcomeLabel, color: '#FF6600' },
        ]
      : [{
          key: 'value',
          name: normalizeOutcomeLabel(activeOutcome.outcome_text) ?? activeOutcome.outcome_text,
          color: activeOutcome.outcome_index === OUTCOME_INDEX.NO ? '#FF6600' : '#2D9CDB',
        }]),
    [activeOutcome.outcome_index, activeOutcome.outcome_text, showBothOutcomes, yesOutcomeLabel, noOutcomeLabel, normalizeOutcomeLabel],
  )
  const chartSignature = useMemo(
    () => `${market.condition_id}:${activeOutcomeIndex}:${activeTimeRange}:${showBothOutcomes ? 'both' : 'single'}`,
    [market.condition_id, activeOutcomeIndex, activeTimeRange, showBothOutcomes],
  )
  const hasChartData = chartData.length > 0
  const watermark = useMemo(
    () => ({
      iconSvg: svgLogo(),
      label: process.env.NEXT_PUBLIC_SITE_NAME,
    }),
    [],
  )

  const activeSeriesKey = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? 'no' : 'yes')
    : 'value'
  const primarySeriesColor = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? '#FF6600' : '#2D9CDB')
    : (series[0]?.color ?? '#2D9CDB')
  const hoveredValue = cursorSnapshot?.values?.[activeSeriesKey]
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
  const resolvedValue = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
    ? hoveredValue
    : latestValue
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
                onCursorDataChange={setCursorSnapshot}
                xAxisTickCount={isMobile ? 3 : 6}
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
              />
            )
          : (
              <div className="flex min-h-16 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Price history is unavailable for this outcome.
              </div>
            )}
        controls={(
          <div className="mt-3 flex flex-wrap items-center gap-3 pb-2">
            <MarketOutcomeMetaInformation market={market} />
            {hasChartData && (
              <div className="ml-auto">
                <EventChartControls
                  timeRanges={TIME_RANGES}
                  activeTimeRange={activeTimeRange}
                  onTimeRangeChange={setActiveTimeRange}
                  showOutcomeSwitch={showOutcomeSwitch}
                  oppositeOutcomeLabel={normalizeOutcomeLabel(oppositeOutcome.outcome_text) ?? oppositeOutcome.outcome_text}
                  onShuffle={() => setActiveOutcomeIndex(oppositeOutcome.outcome_index)}
                  settings={chartSettings}
                  onSettingsChange={setChartSettings}
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

function MarketOutcomeMetaInformation({ market }: { market: Market }) {
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

  const shouldShowNew = isMarketNew(market.created_at)
  const formattedVolume = Number.isFinite(resolvedVolume)
    ? (resolvedVolume || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
  const volumeLabel = `$${formattedVolume} Vol.`
  const expiryTooltip = t.rich(
    'This is estimated end date.<br></br>See rules below for specific resolution details.',
    { br: () => <br /> },
  )
  const maybeEndDate = market.end_time ? new Date(market.end_time) : null
  const expiryDate = maybeEndDate && !Number.isNaN(maybeEndDate.getTime()) ? maybeEndDate : null

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
      {expiryDate && (
        <span className="mx-1.5 h-4 w-px bg-muted-foreground/40" aria-hidden="true" />
      )}
      {expiryDate && (
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1.5 text-sm leading-tight font-semibold text-muted-foreground">
              <Clock3Icon className="size-4 text-muted-foreground" strokeWidth={2.5} />
              <span>{formatDate(expiryDate)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{expiryTooltip}</p>
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

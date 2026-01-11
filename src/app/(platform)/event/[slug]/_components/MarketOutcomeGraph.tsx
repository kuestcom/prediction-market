'use client'

import type { TimeRange } from '@/app/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { PredictionChartCursorSnapshot } from '@/components/PredictionChart'
import type { Market, Outcome } from '@/types'
import { useEffect, useMemo, useState } from 'react'
import EventChartControls from '@/app/(platform)/event/[slug]/_components/EventChartControls'
import EventChartHeader from '@/app/(platform)/event/[slug]/_components/EventChartHeader'
import EventChartLayout from '@/app/(platform)/event/[slug]/_components/EventChartLayout'
import {
  buildMarketTargets,
  TIME_RANGES,
  useEventPriceHistory,
} from '@/app/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import PredictionChart from '@/components/PredictionChart'
import { useWindowSize } from '@/hooks/useWindowSize'
import { OUTCOME_INDEX } from '@/lib/constants'

interface MarketOutcomeGraphProps {
  market: Market
  outcome: Outcome
  allMarkets: Market[]
  eventCreatedAt: string
  isMobile: boolean
}

export default function MarketOutcomeGraph({ market, outcome, allMarkets, eventCreatedAt, isMobile }: MarketOutcomeGraphProps) {
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('ALL')
  const [activeOutcomeIndex, setActiveOutcomeIndex] = useState(outcome.outcome_index)
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const marketTargets = useMemo(() => buildMarketTargets(allMarkets), [allMarkets])
  const { width: windowWidth } = useWindowSize()
  const chartWidth = isMobile ? ((windowWidth || 400) * 0.84) : Math.min((windowWidth ?? 1440) * 0.55, 900)

  useEffect(() => {
    setActiveOutcomeIndex(outcome.outcome_index)
    setCursorSnapshot(null)
  }, [outcome.token_id, outcome.outcome_index])

  useEffect(() => {
    setCursorSnapshot(null)
  }, [activeTimeRange, activeOutcomeIndex])

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

  const {
    normalizedHistory,
  } = useEventPriceHistory({
    eventId: market.event_id,
    range: activeTimeRange,
    targets: marketTargets,
    eventCreatedAt,
  })

  const chartData = useMemo(
    () => buildChartData(normalizedHistory, market.condition_id, activeOutcomeIndex),
    [normalizedHistory, market.condition_id, activeOutcomeIndex],
  )
  const leadingGapStart = normalizedHistory[0]?.date ?? null

  const series = useMemo(
    () => [{
      key: 'value',
      name: activeOutcome.outcome_text,
      color: activeOutcome.outcome_index === OUTCOME_INDEX.NO ? '#FF6600' : '#2D9CDB',
    }],
    [activeOutcome.outcome_index, activeOutcome.outcome_text],
  )
  const chartSignature = useMemo(
    () => `${market.condition_id}:${activeOutcomeIndex}:${activeTimeRange}`,
    [market.condition_id, activeOutcomeIndex, activeTimeRange],
  )
  const hasChartData = chartData.length > 0
  const watermark = useMemo(
    () => ({
      iconSvg: process.env.NEXT_PUBLIC_SITE_LOGO_SVG,
      label: process.env.NEXT_PUBLIC_SITE_NAME,
    }),
    [],
  )

  const hoveredValue = cursorSnapshot?.values?.value
  const latestValue = useMemo(() => {
    for (let index = chartData.length - 1; index >= 0; index -= 1) {
      const value = chartData[index]?.value
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData])
  const resolvedValue = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
    ? hoveredValue
    : latestValue
  const baselineValue = useMemo(() => {
    for (const point of chartData) {
      if (Number.isFinite(point.value)) {
        return point.value
      }
    }
    return null
  }, [chartData])
  const currentValue = resolvedValue

  return (
    <EventChartLayout
      header={hasChartData
        ? (
            <EventChartHeader
              isSingleMarket
              activeOutcomeIndex={activeOutcome.outcome_index as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO}
              activeOutcomeLabel={activeOutcome.outcome_text}
              primarySeriesColor={series[0]?.color ?? '#2D9CDB'}
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
              height={260}
              margin={{ top: 20, right: 40, bottom: 48, left: 0 }}
              dataSignature={chartSignature}
              onCursorDataChange={setCursorSnapshot}
              xAxisTickCount={isMobile ? 3 : 6}
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
      controls={hasChartData
        ? (
            <div className="pb-2">
              <EventChartControls
                hasChartData
                timeRanges={TIME_RANGES}
                activeTimeRange={activeTimeRange}
                onTimeRangeChange={setActiveTimeRange}
                showOutcomeSwitch={showOutcomeSwitch}
                oppositeOutcomeLabel={oppositeOutcome.outcome_text}
                onShuffle={() => setActiveOutcomeIndex(oppositeOutcome.outcome_index)}
              />
            </div>
          )
        : null}
    />
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

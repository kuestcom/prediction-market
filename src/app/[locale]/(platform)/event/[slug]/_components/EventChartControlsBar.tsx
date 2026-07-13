'use client'

import type { SetStateAction } from 'react'
import type { ChartSettings } from './EventChartControls'
import type { TimeRange } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { Event } from '@/types'
import type { SeriesConfig } from '@/types/PredictionChartTypes'
import { TIME_RANGES } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import EventChartControls from './EventChartControls'
import EventMetaInformation from './EventMetaInformation'

interface EventChartControlsBarProps {
  event: Event
  nowMs: number | null
  hasChartData: boolean
  activeTimeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  isSingleMarket: boolean
  oppositeOutcomeLabel: string
  onShuffle: () => void
  marketOptions: SeriesConfig[]
  selectedMarketIds: string[]
  maxSeriesCount: number
  onToggleMarket: (marketId: string) => void
  settings: ChartSettings
  onSettingsChange: (value: SetStateAction<ChartSettings>) => void
  onExportData: () => void
}

export default function EventChartControlsBar({
  event,
  nowMs,
  hasChartData,
  activeTimeRange,
  onTimeRangeChange,
  isSingleMarket,
  oppositeOutcomeLabel,
  onShuffle,
  marketOptions,
  selectedMarketIds,
  maxSeriesCount,
  onToggleMarket,
  settings,
  onSettingsChange,
  onExportData,
}: EventChartControlsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <EventMetaInformation event={event} currentTimestamp={nowMs} />
      {hasChartData
        ? (
            <EventChartControls
              timeRanges={TIME_RANGES}
              activeTimeRange={activeTimeRange}
              onTimeRangeChange={onTimeRangeChange}
              showOutcomeSwitch={isSingleMarket}
              oppositeOutcomeLabel={oppositeOutcomeLabel}
              onShuffle={onShuffle}
              showMarketSelector={!isSingleMarket}
              marketOptions={marketOptions}
              selectedMarketIds={selectedMarketIds}
              maxSeriesCount={maxSeriesCount}
              onToggleMarket={onToggleMarket}
              settings={settings}
              onSettingsChange={onSettingsChange}
              onExportData={onExportData}
            />
          )
        : null}
    </div>
  )
}

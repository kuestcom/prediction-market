'use client'

import type { ReactNode } from 'react'
import type { TradeFlowLabelItem } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'
import type {
  DataPoint,
  PredictionChartAnnotationMarker,
  PredictionChartCursorSnapshot,
  PredictionChartProps,
  SeriesConfig,
} from '@/types/PredictionChartTypes'
import dynamic from 'next/dynamic'
import { EVENT_PLOT_CLIP_RIGHT_PADDING } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'
import EventChartTradeFlow from './EventChartTradeFlow'

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <div className="h-83 w-full" /> },
)

interface EventChartCanvasProps {
  chartData: DataPoint[]
  legendSeries: SeriesConfig[]
  chartWidth: number
  chartHeight?: number
  chartScopeKey: string
  onCursorDataChange: (snapshot: PredictionChartCursorSnapshot | null) => void
  isMobile: boolean
  isSingleMarket: boolean
  chartSettings: {
    autoscale: boolean
    xAxis: boolean
    yAxis: boolean
    horizontalGrid: boolean
    verticalGrid: boolean
    annotations: boolean
  }
  chartAnnotationMarkers: PredictionChartAnnotationMarker[]
  leadingGapStart: Date | null
  legendContent: ReactNode
  watermark?: { iconSvg?: string | null, iconImageUrl?: string | null, label?: string | null }
  tradeFlowItems: TradeFlowLabelItem[]
}

export default function EventChartCanvas({
  chartData,
  legendSeries,
  chartWidth,
  chartHeight = 332,
  chartScopeKey,
  onCursorDataChange,
  isMobile,
  isSingleMarket,
  chartSettings,
  chartAnnotationMarkers,
  leadingGapStart,
  legendContent,
  watermark,
  tradeFlowItems,
}: EventChartCanvasProps) {
  return (
    <div className="relative">
      <PredictionChart
        data={chartData}
        series={legendSeries}
        width={chartWidth}
        height={chartHeight}
        margin={{ top: 30, right: 40, bottom: 52, left: 0 }}
        dataSignature={chartScopeKey}
        onCursorDataChange={onCursorDataChange}
        xAxisTickCount={isMobile ? 2 : 4}
        autoscale={chartSettings.autoscale}
        showXAxis={chartSettings.xAxis}
        showYAxis={chartSettings.yAxis}
        showHorizontalGrid={chartSettings.horizontalGrid}
        showVerticalGrid={chartSettings.verticalGrid}
        showAnnotations={chartSettings.annotations && chartAnnotationMarkers.length > 0}
        annotationMarkers={chartAnnotationMarkers}
        leadingGapStart={leadingGapStart}
        legendContent={legendContent}
        showLegend={!isSingleMarket}
        watermark={isSingleMarket ? undefined : watermark}
        lineCurve="monotoneX"
        plotClipPadding={{ right: EVENT_PLOT_CLIP_RIGHT_PADDING }}
        tooltipLabelVariant="panel"
      />
      <EventChartTradeFlow items={tradeFlowItems} />
    </div>
  )
}

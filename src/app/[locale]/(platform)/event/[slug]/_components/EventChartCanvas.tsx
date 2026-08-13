'use client'

import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import dynamic from 'next/dynamic'
import { useCallback, useLayoutEffect, useRef } from 'react'

import type { TradeFlowLabelItem } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'
import type {
  DataPoint,
  PredictionChartAnnotationMarker,
  PredictionChartCursorSnapshot,
  PredictionChartProps,
  SeriesConfig,
} from '@/types/PredictionChartTypes'

import { EVENT_PLOT_CLIP_RIGHT_PADDING } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'

import EventChartTradeFlow from './EventChartTradeFlow'

const PredictionChart = dynamic<PredictionChartProps>(() => import('@/components/PredictionChart'), {
  ssr: false,
  loading: () => <div className="h-83 w-full" />,
})

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
  disableResetAnimation: boolean
  legendContent: ReactNode
  watermark?: { iconSvg?: string | null; iconImageUrl?: string | null; label?: string | null }
  tradeFlowItems: TradeFlowLabelItem[]
}

const CHART_MARGIN = { top: 30, right: 40, bottom: 52, left: 0 }
const CURSOR_DOT_RADIUS = 4

export function muteEventChartContinuation(
  canvas: HTMLCanvasElement,
  snapshotCanvas: HTMLCanvasElement,
  cursorBitmapX: number,
  mutedColor: string,
  opacity: number,
) {
  const context = canvas.getContext('2d')
  const snapshotContext = snapshotCanvas.getContext('2d')
  if (!context || !snapshotContext || canvas.width <= 0 || canvas.height <= 0) {
    return false
  }

  snapshotCanvas.width = canvas.width
  snapshotCanvas.height = canvas.height
  snapshotContext.globalCompositeOperation = 'source-over'
  snapshotContext.clearRect(0, 0, snapshotCanvas.width, snapshotCanvas.height)
  snapshotContext.drawImage(canvas, 0, 0)
  snapshotContext.globalCompositeOperation = 'source-in'
  snapshotContext.fillStyle = mutedColor
  snapshotContext.fillRect(0, 0, snapshotCanvas.width, snapshotCanvas.height)

  const renderedWidth = canvas.getBoundingClientRect().width
  const pixelRatio = renderedWidth > 0 ? canvas.width / renderedWidth : 1
  const splitX = Math.max(0, Math.min(canvas.width, cursorBitmapX + CURSOR_DOT_RADIUS * pixelRatio))

  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(splitX, 0, canvas.width - splitX, canvas.height)
  context.beginPath()
  context.rect(splitX, 0, canvas.width - splitX, canvas.height)
  context.clip()
  context.globalCompositeOperation = 'source-over'
  context.globalAlpha = opacity
  context.drawImage(snapshotCanvas, 0, 0)
  context.restore()
  return true
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
  disableResetAnimation,
  legendContent,
  watermark,
  tradeFlowItems,
}: EventChartCanvasProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const muteFrameRef = useRef<number | null>(null)
  const muteTimeoutRef = useRef<number | null>(null)

  useLayoutEffect(function cleanUpMutedContinuation() {
    return function cancelMutedContinuationOnUnmount() {
      if (muteTimeoutRef.current !== null) {
        window.clearTimeout(muteTimeoutRef.current)
      }
      if (muteFrameRef.current !== null) {
        window.cancelAnimationFrame(muteFrameRef.current)
      }
    }
  }, [])

  const handleChartPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isSingleMarket) {
        return
      }

      const canvas = chartContainerRef.current?.querySelector<HTMLCanvasElement>('canvas[data-chart-renderer="canvas"]')
      if (!canvas) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || event.clientX < rect.left || event.clientX > rect.right) {
        return
      }

      const renderedX = ((event.clientX - rect.left) / rect.width) * chartWidth
      const innerWidth = Math.max(1, chartWidth - CHART_MARGIN.left - CHART_MARGIN.right)
      const localX = Math.max(0, Math.min(innerWidth, renderedX - CHART_MARGIN.left))
      const cursorBitmapX = (CHART_MARGIN.left + localX) * (canvas.width / chartWidth)

      if (muteTimeoutRef.current !== null) {
        window.clearTimeout(muteTimeoutRef.current)
      }
      if (muteFrameRef.current !== null) {
        window.cancelAnimationFrame(muteFrameRef.current)
      }
      muteTimeoutRef.current = window.setTimeout(() => {
        muteTimeoutRef.current = null
        muteFrameRef.current = window.requestAnimationFrame(() => {
          muteFrameRef.current = null
          const snapshotCanvas = snapshotCanvasRef.current ?? document.createElement('canvas')
          snapshotCanvasRef.current = snapshotCanvas
          const isDarkMode = document.documentElement.classList.contains('dark')
          muteEventChartContinuation(
            canvas,
            snapshotCanvas,
            cursorBitmapX,
            isDarkMode ? '#94A3B8' : '#64748B',
            isDarkMode ? 0.38 : 0.18,
          )
        })
      }, 0)
    },
    [chartWidth, isSingleMarket],
  )

  const handleCursorDataChange = useCallback(
    (snapshot: PredictionChartCursorSnapshot | null) => {
      onCursorDataChange(snapshot)
    },
    [onCursorDataChange],
  )

  return (
    <div ref={chartContainerRef} className="relative" onPointerMove={handleChartPointerMove}>
      <PredictionChart
        data={chartData}
        series={legendSeries}
        width={chartWidth}
        height={chartHeight}
        margin={CHART_MARGIN}
        dataSignature={chartScopeKey}
        onCursorDataChange={handleCursorDataChange}
        xAxisTickCount={isMobile ? 2 : 4}
        autoscale={chartSettings.autoscale}
        showXAxis={chartSettings.xAxis}
        showYAxis={chartSettings.yAxis}
        showHorizontalGrid={chartSettings.horizontalGrid}
        showVerticalGrid={chartSettings.verticalGrid}
        showAnnotations={chartSettings.annotations && chartAnnotationMarkers.length > 0}
        annotationMarkers={chartAnnotationMarkers}
        leadingGapStart={leadingGapStart}
        disableResetAnimation={disableResetAnimation}
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

import type { Event, EventSeriesEntry } from '@/types'

export interface EventChartProps {
  event: Event
  isMobile: boolean
  seriesEvents?: EventSeriesEntry[]
  showControls?: boolean
  showSeriesNavigation?: boolean
  showWatermark?: boolean
  compactLegend?: boolean
  chartHeight?: number
  isSingleMarketOverride?: boolean
  forceVisible?: boolean
}

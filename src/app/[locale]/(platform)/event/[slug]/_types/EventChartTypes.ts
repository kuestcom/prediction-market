import type { Event, EventSeriesEntry } from '@/types'

export type EventChartLegendVariant = 'default' | 'compact' | 'card'

export interface EventChartProps {
  event: Event
  isMobile: boolean
  seriesEvents?: EventSeriesEntry[]
  showControls?: boolean
  showSeriesNavigation?: boolean
  showWatermark?: boolean
  compactLegend?: boolean
  legendVariant?: EventChartLegendVariant
  chartWidth?: number
  chartHeight?: number
  isSingleMarketOverride?: boolean
  forceVisible?: boolean
}

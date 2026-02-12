import type { Event, EventSeriesEntry } from '@/types'

export interface EventChartProps {
  event: Event
  isMobile: boolean
  seriesEvents?: EventSeriesEntry[]
}

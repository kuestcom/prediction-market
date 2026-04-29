import type { Event, EventLiveChartConfig } from '@/types'

export function shouldUseLiveSeriesChart(event: Event, config: EventLiveChartConfig | null | undefined) {
  if (!config?.enabled) {
    return false
  }

  if (event.total_markets_count !== 1) {
    return false
  }

  const seriesSlug = event.series_slug?.trim()
  return Boolean(seriesSlug && seriesSlug === config.series_slug)
}

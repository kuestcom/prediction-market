'use client'

import type { Event, EventLiveChartConfig, EventSeriesEntry } from '@/types'
import { useIsMobile } from '@/hooks/useIsMobile'
import { shouldUseLiveSeriesChart } from '../_utils/eventLiveSeriesChartEligibility'
import EventChart from './EventChart'
import EventLiveSeriesChart from './EventLiveSeriesChart'

interface EventChartSectionProps {
  event: Event
  seriesEvents?: EventSeriesEntry[]
  liveChartConfig?: EventLiveChartConfig | null
}

export default function EventChartSection({
  event,
  seriesEvents = [],
  liveChartConfig = null,
}: EventChartSectionProps) {
  const isMobile = useIsMobile()

  if (liveChartConfig && shouldUseLiveSeriesChart(event, liveChartConfig)) {
    return (
      <EventLiveSeriesChart
        event={event}
        isMobile={isMobile}
        seriesEvents={seriesEvents}
        config={liveChartConfig}
      />
    )
  }

  return <EventChart event={event} isMobile={isMobile} seriesEvents={seriesEvents} />
}

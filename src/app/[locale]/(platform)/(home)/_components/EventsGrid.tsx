'use client'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event } from '@/types'
import HydratedEventsGrid from '@/app/[locale]/(platform)/(home)/_components/HydratedEventsGrid'

interface EventsGridProps {
  filters: FilterState
  initialEvents: Event[]
  initialCurrentTimestamp: number | null
  maxColumns?: number
  onClearFilters?: () => void
  routeMainTag: string
  routeTag: string
}

export default function EventsGrid({
  filters,
  initialEvents,
  initialCurrentTimestamp,
  maxColumns,
  onClearFilters,
  routeMainTag,
  routeTag,
}: EventsGridProps) {
  return (
    <HydratedEventsGrid
      filters={filters}
      initialEvents={initialEvents}
      initialCurrentTimestamp={initialCurrentTimestamp}
      maxColumns={maxColumns}
      onClearFilters={onClearFilters}
      routeMainTag={routeMainTag}
      routeTag={routeTag}
    />
  )
}

'use client'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event } from '@/types'
import HydratedEventsGrid from '@/app/[locale]/(platform)/(home)/_components/HydratedEventsGrid'

interface EventsGridProps {
  filters: FilterState
  initialEvents: Event[]
  maxColumns?: number
  onClearFilters?: () => void
  routeMainTag: string
  routeTag: string
}

export default function EventsGrid({
  filters,
  initialEvents,
  maxColumns,
  onClearFilters,
  routeMainTag,
  routeTag,
}: EventsGridProps) {
  return (
    <HydratedEventsGrid
      filters={filters}
      initialEvents={initialEvents}
      maxColumns={maxColumns}
      onClearFilters={onClearFilters}
      routeMainTag={routeMainTag}
      routeTag={routeTag}
    />
  )
}

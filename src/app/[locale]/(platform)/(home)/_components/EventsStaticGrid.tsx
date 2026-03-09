import type { Event } from '@/types'
import EventCard from '@/app/[locale]/(platform)/(home)/_components/EventCard'
import { cn } from '@/lib/utils'

interface EventsStaticGridProps {
  events: Event[]
  priceOverridesByMarket: Record<string, number>
  maxColumns?: number
  isFetching?: boolean
  currentTimestamp?: number | null
}

export function getStaticGridColumnsClassName(maxColumns?: number) {
  const normalizedMaxColumns = Number.isFinite(maxColumns)
    ? Math.max(1, Math.floor(maxColumns as number))
    : 4

  if (normalizedMaxColumns === 1) {
    return 'grid-cols-1'
  }

  if (normalizedMaxColumns === 2) {
    return 'grid-cols-1 md:grid-cols-2'
  }

  if (normalizedMaxColumns === 3) {
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }

  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
}

export default function EventsStaticGrid({
  events,
  priceOverridesByMarket,
  maxColumns,
  isFetching = false,
  currentTimestamp = null,
}: EventsStaticGridProps) {
  return (
    <div className={cn('grid gap-3', getStaticGridColumnsClassName(maxColumns), { 'opacity-80': isFetching })}>
      {events.map(event => (
        <EventCard
          key={event.id}
          event={event}
          priceOverridesByMarket={priceOverridesByMarket}
          enableHomeSportsMoneylineLayout
          currentTimestamp={currentTimestamp}
        />
      ))}
    </div>
  )
}

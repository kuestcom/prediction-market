import EventCardSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventCardSkeleton'

interface EventsGridSkeletonProps {
  count?: number
  maxColumns?: number
}

function getGridColumnsClass(maxColumns = 4) {
  if (maxColumns <= 1) {
    return 'grid gap-3'
  }

  if (maxColumns === 2) {
    return 'grid gap-3 md:grid-cols-2'
  }

  if (maxColumns === 3) {
    return 'grid gap-3 md:grid-cols-2 lg:grid-cols-3'
  }

  return 'grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
}

export default function EventsGridSkeleton({ count = 12, maxColumns }: EventsGridSkeletonProps) {
  return (
    <div className="w-full">
      <div className={getGridColumnsClass(maxColumns)}>
        {Array.from({ length: count }, (_, i) => (
          <EventCardSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    </div>
  )
}

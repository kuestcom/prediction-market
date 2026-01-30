import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <div className="container py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[75%] shrink-0 rounded md:w-56" />
          <Skeleton className="size-9 shrink-0 rounded" />
          <Skeleton className="size-9 shrink-0 rounded" />
        </div>
      </div>

      <main className="container grid gap-4">
        <EventsGridSkeleton />
      </main>
    </>
  )
}

import EventCardSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventCardSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  const subtagWidths = [
    'w-14',
    'w-16',
    'w-12',
    'w-20',
    'w-12',
    'w-16',
    'w-20',
    'w-14',
  ] as const

  return (
    <main className="container py-4">
      <div className="flex min-w-0 gap-6 lg:items-start lg:gap-10">
        <aside className="hidden w-47.5 shrink-0 lg:flex lg:flex-col lg:gap-3">
          <Skeleton className="h-12 w-full rounded-md" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={`category-sidebar-skeleton-${index}`} className="h-8 w-full rounded-md" />
          ))}
        </aside>

        <div className="min-w-0 flex-1 space-y-4 lg:space-y-5">
          <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <Skeleton className="hidden h-10 w-52 rounded-sm lg:block" />

            <div className="order-3 max-w-full min-w-0 flex-1 overflow-hidden lg:hidden">
              <div className="flex w-full max-w-full min-w-0 items-center gap-4 overflow-x-hidden">
                <Skeleton className="hidden h-8 w-28 shrink-0 rounded-sm md:block" />
                <Skeleton className="h-8 w-10 shrink-0 rounded-sm" />
                {subtagWidths.map((width, index) => (
                  <Skeleton key={`${width}-${index}`} className={`h-8 shrink-0 rounded-sm ${width}`} />
                ))}
              </div>
            </div>

            <div className="order-1 flex w-full min-w-0 items-center gap-3 md:order-3 md:ml-auto md:w-auto md:min-w-0">
              <Skeleton className="h-9 w-full shrink-0 rounded-sm md:w-56" />
              <Skeleton className="size-9 shrink-0 rounded-sm" />
              <Skeleton className="size-9 shrink-0 rounded-sm" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }, (_, index) => (
              <EventCardSkeleton key={`category-card-skeleton-${index}`} />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

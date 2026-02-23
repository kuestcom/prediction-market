import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  const subtagWidths = [
    'w-14',
    'w-16',
    'w-12',
    'w-20',
    'w-[72px]',
    'w-[60px]',
  ] as const

  return (
    <>
      <div className="container py-4">
        <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="order-3 max-w-full min-w-0 flex-1 overflow-hidden md:order-1 md:flex md:items-center">
            <div className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-hidden">
              <Skeleton className="hidden h-8 w-28 shrink-0 rounded-sm md:block" />
              <Skeleton className="h-8 w-10 shrink-0 rounded-sm" />
              {subtagWidths.map((width, index) => (
                <Skeleton key={`${width}-${index}`} className={`h-8 shrink-0 rounded-sm ${width}`} />
              ))}
            </div>
          </div>

          <Skeleton className="order-4 hidden h-5 w-px shrink-0 md:order-2 md:block" />

          <div className="order-1 flex w-full min-w-0 items-center gap-3 md:order-3 md:ml-auto md:w-auto md:min-w-0">
            <Skeleton className="h-9 w-full shrink-0 rounded-sm md:w-56" />
            <Skeleton className="size-9 shrink-0 rounded-sm" />
            <Skeleton className="size-9 shrink-0 rounded-sm" />
          </div>
        </div>
      </div>

      <main className="container grid gap-4">
        <EventsGridSkeleton />
      </main>
    </>
  )
}

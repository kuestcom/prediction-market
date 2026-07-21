import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface AdminPanelSkeletonProps {
  className?: string
  rowCount?: number
}

interface AdminAccordionSkeletonProps {
  itemCount: number
  showDescription?: boolean
}

export function AdminAccordionSkeleton({ itemCount, showDescription = false }: AdminAccordionSkeletonProps) {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading admin content">
      {Array.from({ length: itemCount }).map((_, index) => (
        <div
          key={index}
          className="flex h-18 items-center justify-between gap-4 rounded-xl border bg-background px-4"
          aria-hidden="true"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className={cn('shrink-0', showDescription ? 'size-9 rounded-lg' : 'size-4')} />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Skeleton className="h-4 w-36 max-w-full" />
              {showDescription && <Skeleton className="h-3 w-80 max-w-full" />}
            </div>
          </div>
          <Skeleton className="size-6 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function AdminPanelSkeleton({ className, rowCount = 3 }: AdminPanelSkeletonProps) {
  return (
    <section className={cn('grid gap-5 rounded-lg border bg-background p-6', className)} aria-hidden="true">
      <div className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 flex-1 gap-2">
          <Skeleton className="h-5 w-36 max-w-full" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <Skeleton className="size-9 shrink-0 rounded-md" />
      </div>

      <div className="grid gap-4">
        {Array.from({ length: rowCount }).map((_, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function AdminSettingsSkeleton({ sectionCount = 3 }: { sectionCount?: number }) {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading admin content">
      {Array.from({ length: sectionCount }).map((_, index) => (
        <AdminPanelSkeleton key={index} rowCount={index === 0 ? 2 : 3} />
      ))}
    </div>
  )
}

export function AdminCalendarSkeleton() {
  return (
    <div
      className="grid min-h-[420px] grid-rows-[auto_1fr] gap-4 rounded-sm border bg-background p-4"
      role="status"
      aria-label="Loading calendar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-7 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-7 grid-rows-5 gap-px overflow-hidden rounded-sm bg-border" aria-hidden="true">
        {Array.from({ length: 35 }).map((_, index) => (
          <div key={index} className="bg-background p-2">
            <Skeleton className="size-5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminPageSkeleton() {
  return (
    <section className="grid min-w-0 gap-4">
      <div className="grid gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <AdminSettingsSkeleton />
    </section>
  )
}

'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PositionItemSkeletonProps {
  isInfiniteScroll?: boolean
}

export default function PublicPositionItemSkeleton({ isInfiniteScroll = false }: PositionItemSkeletonProps) {
  return (
    <div className={cn(`
      flex items-center gap-3 border-b border-border px-3 py-4 transition-colors
      last:border-b-0
      sm:gap-4 sm:px-5
    `, { 'animate-pulse': isInfiniteScroll })}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">

        <Skeleton className="size-10 shrink-0 rounded-sm bg-muted sm:size-12" />

        <div className="min-w-0 flex-1 space-y-2">

          <Skeleton
            className="h-4"
            style={{
              width: isInfiniteScroll
                ? '60%'
                : '80%',
            }}
          />

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">

            <Skeleton className="h-6 w-16 rounded-md" />

            <Skeleton className="h-3 w-16" />

            <Skeleton className="hidden h-3 w-12 sm:block" />
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-1 text-right">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-8" />
      </div>

      <div className="shrink-0 space-y-1 text-right">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-10" />

        <Skeleton className="h-3 w-12 sm:hidden" />
      </div>
    </div>
  )
}

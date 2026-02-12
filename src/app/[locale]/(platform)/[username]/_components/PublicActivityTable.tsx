import type { RefObject } from 'react'
import type { ActivityOrder } from '@/types'
import { tableHeaderClass } from '@/lib/constants'
import { cn } from '@/lib/utils'
import PublicActivityRow from './PublicActivityRow'

interface PublicActivityTableProps {
  activities: ActivityOrder[]
  isLoading: boolean
  hasError: boolean
  onRetry: () => void
  isFetchingNextPage: boolean
  isLoadingMore: boolean
  infiniteScrollError: string | null
  onRetryLoadMore: () => void
  loadMoreRef: RefObject<HTMLDivElement | null>
}

export default function PublicActivityTable({
  activities,
  isLoading,
  hasError,
  onRetry,
  isFetchingNextPage,
  isLoadingMore,
  infiniteScrollError,
  onRetryLoadMore,
  loadMoreRef,
}: PublicActivityTableProps) {
  const hasNoData = !isLoading && activities.length === 0
  const colSpan = 4
  let body = null

  if (isLoading) {
    body = (
      <tr>
        <td colSpan={colSpan} className="p-0">
          <div className="space-y-3 px-2 py-3 sm:px-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-14 rounded-lg border bg-muted/30"
              />
            ))}
          </div>
        </td>
      </tr>
    )
  }
  else if (hasError) {
    body = (
      <tr>
        <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
          Could not load activity.
          {' '}
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-2"
          >
            Retry
          </button>
        </td>
      </tr>
    )
  }
  else if (hasNoData) {
    body = (
      <tr>
        <td colSpan={colSpan} className="py-12 text-center text-sm text-muted-foreground">
          No activity found.
        </td>
      </tr>
    )
  }
  else {
    body = (
      <>
        {activities.map(activity => (
          <PublicActivityRow
            key={activity.id}
            activity={activity}
          />
        ))}
        {(isFetchingNextPage || isLoadingMore) && (
          <tr>
            <td colSpan={colSpan} className="py-3 text-center text-xs text-muted-foreground">
              Loading more...
            </td>
          </tr>
        )}
        <tr>
          <td colSpan={colSpan} className="p-0">
            <div ref={loadMoreRef} />
          </td>
        </tr>
        {infiniteScrollError && (
          <tr>
            <td colSpan={colSpan} className="py-3 text-center text-xs text-no">
              {infiniteScrollError}
              {' '}
              <button
                type="button"
                onClick={onRetryLoadMore}
                className="underline underline-offset-2"
              >
                Retry
              </button>
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed border-collapse">
        <thead>
          <tr className="border-b bg-background">
            <th className={cn(tableHeaderClass, 'w-48 text-left')}>Activity</th>
            <th className={cn(tableHeaderClass, 'w-[46%] text-left')}>Market</th>
            <th className={cn(tableHeaderClass, 'w-32 text-right')}>Value</th>
            <th className={cn(tableHeaderClass, 'w-32 text-right')}>
              <span className="sr-only">Time</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {body}
        </tbody>
      </table>
    </div>
  )
}

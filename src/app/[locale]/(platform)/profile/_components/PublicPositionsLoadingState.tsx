'use client'

import { SearchIcon } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import PublicPositionItemSkeleton from './PublicPositionItemSkeleton'

interface PositionsLoadingStateProps {
  skeletonCount?: number
  isSearchActive?: boolean
  searchQuery?: string
  marketStatusFilter?: 'active' | 'closed'
  retryCount?: number
}

function subscribeToWindowResize(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange)
  return () => window.removeEventListener('resize', onStoreChange)
}

function getViewportWidthSnapshot() {
  return window.innerWidth
}

function getViewportWidthServerSnapshot() {
  return 1024
}

export default function PublicPositionsLoadingState({
  skeletonCount,
  isSearchActive = false,
  searchQuery = '',
  marketStatusFilter = 'active',
  retryCount = 0,
}: PositionsLoadingStateProps) {
  const viewportWidth = useSyncExternalStore(
    subscribeToWindowResize,
    getViewportWidthSnapshot,
    getViewportWidthServerSnapshot,
  )
  const resolvedCount = skeletonCount ?? (viewportWidth < 768 ? 6 : 8)

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="space-y-0">
        {Array.from({ length: resolvedCount }).map((_, index) => (
          <PublicPositionItemSkeleton key={index} />
        ))}
      </div>

      <div className="p-4 text-center">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {retryCount > 0
              ? 'Retrying...'
              : isSearchActive && searchQuery.trim()
                ? `Searching for "${searchQuery}"...`
                : `Loading ${marketStatusFilter} positions...`}
          </div>

          {isSearchActive && searchQuery.trim() && retryCount === 0 && (
            <div className={`
              inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800
              dark:bg-orange-900/30 dark:text-orange-300
            `}
            >
              <SearchIcon className="size-3" />
              Active search
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { RefreshCwIcon } from 'lucide-react'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PublicPositionsErrorProps {
  isSearchActive?: boolean
  searchQuery?: string
  retryCount?: number
  isLoading?: boolean
  onRetry?: () => void
  onRefreshPage?: () => void
}

export default function PublicPositionsError({
  isSearchActive = false,
  searchQuery,
  retryCount = 0,
  isLoading = false,
  onRetry,
  onRefreshPage,
}: PublicPositionsErrorProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="p-8">
        <AlertBanner
          title="Failed to load positions"
          description={(
            <>
              <p>
                {retryCount > 0
                  ? `Unable to load ${isSearchActive ? 'search results' : 'positions data'} after ${retryCount} attempt${retryCount > 1 ? 's' : ''}. Please check your connection and try again.`
                  : `There was a problem loading the ${isSearchActive ? 'search results' : 'positions data'}. This could be due to a network issue or server error.`}
              </p>
              {isSearchActive && searchQuery && (
                <p className="text-sm">
                  Search query: "
                  {searchQuery}
                  "
                </p>
              )}
              <div className="flex gap-2">
                {onRetry && (
                  <Button
                    type="button"
                    onClick={onRetry}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={isLoading}
                  >
                    <RefreshCwIcon className={cn('size-3', { 'animate-spin': isLoading })} />
                    {isLoading ? 'Retrying...' : 'Try again'}
                  </Button>
                )}
                {retryCount > 2 && onRefreshPage && (
                  <Button
                    type="button"
                    onClick={onRefreshPage}
                    size="sm"
                    variant="ghost"
                  >
                    Refresh page
                  </Button>
                )}
              </div>
            </>
          )}
          descriptionClassName="mt-2 space-y-3"
        />
      </div>
    </div>
  )
}

'use client'

import { RefreshCwIcon } from 'lucide-react'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PublicActivityErrorProps {
  retryCount: number
  isLoading: boolean
  onRetry: () => void
}

export default function PublicActivityError({
  retryCount,
  isLoading,
  onRetry,
}: PublicActivityErrorProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="p-8">
        <AlertBanner
          title="Failed to load activity"
          description={(
            <>
              <p>
                {retryCount > 0
                  ? `Unable to load activity data after ${retryCount} attempt${retryCount > 1 ? 's' : ''}. Please check your connection and try again.`
                  : 'There was a problem loading the activity data. This could be due to a network issue or server error.'}
              </p>
              <div className="flex gap-2">
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
                {retryCount > 2 && (
                  <Button
                    type="button"
                    onClick={() => window.location.reload()}
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

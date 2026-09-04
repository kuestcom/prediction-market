'use client'

import { RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

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
  const t = useExtracted()
  const dataLabel = isSearchActive ? t('search results') : t('positions data')
  const attemptLabel = retryCount > 1 ? t('attempts') : t('attempt')

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="p-8">
        <AlertBanner
          title={t('Failed to load positions')}
          description={
            <>
              <p>
                {retryCount > 0
                  ? t(
                      'Unable to load {data} after {count} {attemptLabel}. Please check your connection and try again.',
                      {
                        data: dataLabel,
                        count: String(retryCount),
                        attemptLabel,
                      },
                    )
                  : t('There was a problem loading the {data}. This could be due to a network issue or server error.', {
                      data: dataLabel,
                    })}
              </p>
              {isSearchActive && searchQuery && (
                <p className="text-sm">{t('Search query: “{query}”', { query: searchQuery })}</p>
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
                    {isLoading ? t('Retrying...') : t('Try again')}
                  </Button>
                )}
                {retryCount > 2 && onRefreshPage && (
                  <Button type="button" onClick={onRefreshPage} size="sm" variant="ghost">
                    {t('Refresh page')}
                  </Button>
                )}
              </div>
            </>
          }
          descriptionClassName="mt-2 space-y-3"
        />
      </div>
    </div>
  )
}

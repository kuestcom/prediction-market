'use client'

import { RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import type { AffiliateDataError } from '@/lib/affiliate-data'

import { Button } from '@/components/ui/button'

interface ErrorDisplayProps {
  error: AffiliateDataError
  fallbackValue?: string
  className?: string
  showRefresh?: boolean
}

export function ErrorDisplay({ fallbackValue, className = '', showRefresh = true }: ErrorDisplayProps) {
  const t = useExtracted()
  function handleRefresh() {
    window.location.reload()
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {fallbackValue && <span className="text-muted-foreground">{fallbackValue}</span>}
      <span className="cursor-help text-xs text-destructive" title={t('Unable to load data')}>
        ⚠️
      </span>
      {showRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
          title={t('Refresh to retry')}
        >
          <RefreshCwIcon className="size-3" />
        </Button>
      )}
    </span>
  )
}

export function ErrorDisplayBlock({
  className = '',
  title,
}: {
  error: AffiliateDataError
  className?: string
  title?: string
}) {
  const t = useExtracted()
  const resolvedTitle = title ?? t('Unable to load data')
  function handleRefresh() {
    window.location.reload()
  }

  return (
    <div className={`rounded-lg border border-destructive/20 bg-destructive/5 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="text-destructive">⚠️</div>
        <div className="flex-1">
          <h4 className="mb-1 font-semibold text-destructive">{resolvedTitle}</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('An error occurred while loading the data. Please try refreshing the page.')}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="text-xs">
            <RefreshCwIcon className="mr-1 size-3" />
            {t('Refresh Page')}
          </Button>
        </div>
      </div>
    </div>
  )
}

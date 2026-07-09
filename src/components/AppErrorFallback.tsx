'use client'

import * as Sentry from '@sentry/nextjs'
import { RotateCcwIcon } from 'lucide-react'
import { useEffect } from 'react'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/button'
import { isNextClientStaleAssetError } from '@/lib/next-client-stale-assets'
import { isNextNotFoundError } from '@/lib/next-http-fallback'
import { cn } from '@/lib/utils'

interface AppErrorFallbackProps {
  description?: string
  error: Error & { digest?: string }
  reset: () => void
  retryLabel?: string
  title?: string
  variant?: 'inline' | 'page'
}

export default function AppErrorFallback({
  description,
  error,
  reset,
  retryLabel = 'Try again',
  title = 'Something went wrong',
  variant = 'inline',
}: AppErrorFallbackProps) {
  useEffect(function captureExceptionEffect() {
    if (isNextNotFoundError(error)) {
      return
    }

    if (isNextClientStaleAssetError(error)) {
      return
    }

    Sentry.captureException(error)
  }, [error])

  return (
    <AlertBanner
      title={title}
      description={(
        <>
          {description && <p>{description}</p>}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              <RotateCcwIcon aria-hidden />
              {retryLabel}
            </Button>
          </div>
        </>
      )}
      className={cn(
        'text-left',
        variant === 'page' && 'mx-auto my-16 w-[min(100%-2rem,32rem)]',
      )}
    />
  )
}

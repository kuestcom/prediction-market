'use client'

import * as Sentry from '@sentry/nextjs'
import { RotateCcwIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
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

    Sentry.captureException(error)
  }, [error])

  return (
    <div
      role="alert"
      className={cn(
        'grid gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-left',
        variant === 'page' && 'mx-auto my-16 w-[min(100%-2rem,32rem)]',
      )}
    >
      <div className="grid gap-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          <RotateCcwIcon aria-hidden />
          {retryLabel}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useExtracted } from 'next-intl'
import AppErrorFallback from '@/components/AppErrorFallback'

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useExtracted()

  return (
    <main className="container py-8">
      <AppErrorFallback
        error={error}
        reset={reset}
        retryLabel={t('Try again')}
        title={t('Something went wrong')}
      />
    </main>
  )
}

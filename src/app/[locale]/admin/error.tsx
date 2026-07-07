'use client'

import { useExtracted } from 'next-intl'
import AppErrorFallback from '@/components/AppErrorFallback'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useExtracted()

  return (
    <AppErrorFallback
      error={error}
      reset={reset}
      retryLabel={t('Try again')}
      title={t('Something went wrong')}
    />
  )
}

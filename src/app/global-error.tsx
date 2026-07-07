'use client'

import AppErrorFallback from '@/components/AppErrorFallback'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <AppErrorFallback error={error} reset={reset} variant="page" />
      </body>
    </html>
  )
}

'use client'

import type { ReactNode } from 'react'
import { ProgressProvider } from '@bprogress/next/app'
import { useHasHydrated } from '@/hooks/useHasHydrated'

function ProgressIndicatorProvider({ children }: { children: ReactNode }) {
  const hasHydrated = useHasHydrated()

  return (
    <>
      {children}
      {hasHydrated && (
        <ProgressProvider
          height="2px"
          color="var(--primary)"
          options={{ showSpinner: false }}
          shallowRouting
          delay={300}
        />
      )}
    </>
  )
}

export default ProgressIndicatorProvider

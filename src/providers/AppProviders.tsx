'use client'

import type { ReactNode } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { lazy, Suspense } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { useHasHydrated } from '@/hooks/useHasHydrated'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import ProgressIndicatorProvider from '@/providers/ProgressIndicatorProvider'

const SpeedInsights = process.env.IS_VERCEL === 'true'
  ? lazy(async () => {
      const mod = await import('@vercel/speed-insights/next')
      return { default: mod.SpeedInsights }
    })
  : null

const queryClient = new QueryClient()

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const site = useSiteIdentity()
  const hasHydrated = useHasHydrated()
  const gaId = site.googleAnalyticsId
  const shouldRenderSpeedInsights = process.env.NODE_ENV === 'production' && hasHydrated

  const content = (
    <div className="min-h-screen bg-background">
      {children}
      <Toaster position="bottom-left" />
      {shouldRenderSpeedInsights && SpeedInsights && (
        <Suspense fallback={null}>
          <SpeedInsights />
        </Suspense>
      )}
      {process.env.NODE_ENV === 'production' && gaId && <GoogleAnalytics gaId={gaId} />}
    </div>
  )

  return (
    <ProgressIndicatorProvider>
      <ThemeProvider attribute="class">
        <QueryClientProvider client={queryClient}>
          {content}
        </QueryClientProvider>
      </ThemeProvider>
    </ProgressIndicatorProvider>
  )
}

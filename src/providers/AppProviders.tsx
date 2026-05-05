'use client'

import type { ReactNode } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import dynamic from 'next/dynamic'
import { Toaster } from '@/components/ui/sonner'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import ProgressIndicatorProvider from '@/providers/ProgressIndicatorProvider'

const SpeedInsights = process.env.IS_VERCEL === 'true'
  ? dynamic(
      () => import('@vercel/speed-insights/next').then(mod => mod.SpeedInsights),
      { ssr: false },
    )
  : () => null

const queryClient = new QueryClient()

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const site = useSiteIdentity()
  const gaId = site.googleAnalyticsId

  const content = (
    <div className="min-h-screen bg-background">
      {children}
      <Toaster position="bottom-left" />
      {process.env.NODE_ENV === 'production' && <SpeedInsights />}
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

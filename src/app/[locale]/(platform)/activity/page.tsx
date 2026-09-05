'use cache'

import type { Metadata } from 'next'

import { getExtracted } from 'next-intl/server'

import ActivityFeed from '@/app/[locale]/(platform)/activity/_components/ActivityFeed'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted()

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name

  return {
    title: t('Activity'),
    description: t('See recent trading activity on {siteName}', { siteName }),
  }
}

export default async function ActivityPage() {
  return (
    <main className="container py-6 md:py-8">
      <ActivityFeed />
    </main>
  )
}

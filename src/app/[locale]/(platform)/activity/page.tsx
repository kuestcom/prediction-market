'use cache'

import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import ActivityFeed from '@/app/[locale]/(platform)/activity/_components/ActivityFeed'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata({ params }: PageProps<'/[locale]/activity'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name

  return {
    title: t('Activity'),
    description: t('See recent trading activity on {siteName}', { siteName }),
  }
}

export default async function ActivityPage({ params }: PageProps<'/[locale]/activity'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-6 md:py-8">
      <ActivityFeed />
    </main>
  )
}

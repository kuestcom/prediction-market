'use cache'

import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import ActivityFeed from '@/app/[locale]/(platform)/activity/_components/ActivityFeed'

export async function generateMetadata({ params }: PageProps<'/[locale]/activity'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  return {
    title: t('Activity'),
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

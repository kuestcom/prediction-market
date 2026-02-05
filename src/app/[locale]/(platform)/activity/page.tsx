import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import ActivityFeed from '@/app/[locale]/(platform)/activity/_components/ActivityFeed'

export const metadata: Metadata = {
  title: 'Activity',
}

export default async function ActivityPage({ params }: PageProps<'/[locale]/activity'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-8 md:py-12">
      <ActivityFeed />
    </main>
  )
}

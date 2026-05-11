import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { cacheLife } from 'next/cache'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'

const HOME_INITIAL_EVENTS_TIMESTAMP_BUCKET_MS = 60_000

function getHomeInitialCurrentTimestamp() {
  return Math.floor(Date.now() / HOME_INITIAL_EVENTS_TIMESTAMP_BUCKET_MS) * HOME_INITIAL_EVENTS_TIMESTAMP_BUCKET_MS
}

async function CachedHomePageContent({
  locale,
}: {
  locale: SupportedLocale
}) {
  'use cache'
  cacheLife({ stale: 900, revalidate: 900, expire: 1800 })

  const currentTimestamp = getHomeInitialCurrentTimestamp()
  return <HomeContent locale={locale} currentTimestamp={currentTimestamp} />
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale

  return <CachedHomePageContent locale={resolvedLocale} />
}

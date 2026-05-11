import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { cacheLife } from 'next/cache'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import {
  getHomeInitialCurrentTimestamp,
  HOME_INITIAL_EVENTS_CACHE_LIFE,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'

async function CachedHomePageContent({
  locale,
}: {
  locale: SupportedLocale
}) {
  'use cache'
  cacheLife(HOME_INITIAL_EVENTS_CACHE_LIFE)

  const currentTimestamp = getHomeInitialCurrentTimestamp()
  return <HomeContent locale={locale} currentTimestamp={currentTimestamp} />
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale

  return <CachedHomePageContent locale={resolvedLocale} />
}

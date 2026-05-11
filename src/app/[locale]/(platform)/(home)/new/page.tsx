'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { cacheLife } from 'next/cache'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import {
  getHomeInitialCurrentTimestamp,
  HOME_INITIAL_EVENTS_CACHE_LIFE,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'
import { getNewPageSeoTitle } from '@/lib/platform-routing'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getNewPageSeoTitle(),
}

export default async function NewPage({ params }: PageProps<'/[locale]/new'>) {
  cacheLife(HOME_INITIAL_EVENTS_CACHE_LIFE)

  const { locale } = await params
  setRequestLocale(locale)
  const currentTimestamp = getHomeInitialCurrentTimestamp()

  return <HomeContent locale={locale} currentTimestamp={currentTimestamp} initialTag={MAIN_TAG_SLUG} />
}

import type { SupportedLocale } from '@/i18n/locales'
import { cacheLife } from 'next/cache'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import {
  getHomeInitialCurrentTimestamp,
  HOME_INITIAL_EVENTS_CACHE_LIFE,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'
import { deferPublicShellPrerenderIfNeeded, shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'

interface HomeInitialContentProps {
  initialMainTag?: string
  initialTag?: string
  locale: SupportedLocale
}

async function CachedHomeInitialContent({
  initialMainTag,
  initialTag,
  locale,
}: HomeInitialContentProps) {
  'use cache'
  cacheLife(HOME_INITIAL_EVENTS_CACHE_LIFE)

  const currentTimestamp = getHomeInitialCurrentTimestamp()

  return (
    <HomeContent
      locale={locale}
      currentTimestamp={currentTimestamp}
      initialTag={initialTag}
      initialMainTag={initialMainTag}
    />
  )
}

async function RuntimeHomeInitialContent({
  initialMainTag,
  initialTag,
  locale,
}: HomeInitialContentProps) {
  await deferPublicShellPrerenderIfNeeded()

  const currentTimestamp = getHomeInitialCurrentTimestamp()

  return (
    <HomeContent
      locale={locale}
      currentTimestamp={currentTimestamp}
      initialTag={initialTag}
      initialMainTag={initialMainTag}
    />
  )
}

export default function HomeInitialContent(props: HomeInitialContentProps) {
  if (shouldPrerenderPublicShell()) {
    return <CachedHomeInitialContent {...props} />
  }

  return <RuntimeHomeInitialContent {...props} />
}

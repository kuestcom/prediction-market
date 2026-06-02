import type { SupportedLocale } from '@/i18n/locales'
import { cacheLife } from 'next/cache'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import {
  getHomeInitialCurrentTimestamp,
  HOME_INITIAL_EVENTS_CACHE_LIFE,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'
import { hasDatabaseEnv } from '@/lib/db/env'
import { deferPublicShellPrerenderIfNeeded, shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'

interface HomeInitialContentProps {
  deferRuntimePrerender?: boolean
  initialMainTag?: string
  initialTag?: string
  locale: SupportedLocale
}

async function HomeInitialContentBody({
  initialMainTag,
  initialTag,
  locale,
}: HomeInitialContentProps) {
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

async function CachedHomeInitialContent(props: HomeInitialContentProps) {
  'use cache'
  cacheLife(HOME_INITIAL_EVENTS_CACHE_LIFE)

  return <HomeInitialContentBody {...props} />
}

async function RuntimeHomeInitialContent(props: HomeInitialContentProps) {
  await deferPublicShellPrerenderIfNeeded()

  return hasDatabaseEnv()
    ? <CachedHomeInitialContent {...props} />
    : <HomeInitialContentBody {...props} />
}

export default function HomeInitialContent({
  deferRuntimePrerender = true,
  ...props
}: HomeInitialContentProps) {
  if (shouldPrerenderPublicShell() || !deferRuntimePrerender) {
    return hasDatabaseEnv()
      ? <CachedHomeInitialContent {...props} />
      : <HomeInitialContentBody {...props} />
  }

  return <RuntimeHomeInitialContent {...props} />
}

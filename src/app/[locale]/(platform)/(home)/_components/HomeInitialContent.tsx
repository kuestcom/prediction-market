import type { SupportedLocale } from '@/i18n/locales'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import {
  getCachedHomeInitialCurrentTimestamp,
  getHomeInitialCurrentTimestamp,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'
import { deferPublicShellPrerenderIfNeeded, shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'

interface HomeInitialContentProps {
  deferRuntimePrerender?: boolean
  initialMainTag?: string
  initialTag?: string
  locale: SupportedLocale
}

interface HomeInitialContentBodyProps extends HomeInitialContentProps {
  currentTimestamp?: number | null
}

async function HomeInitialContentBody({
  currentTimestamp = null,
  initialMainTag,
  initialTag,
  locale,
}: HomeInitialContentBodyProps) {
  return (
    <HomeContent
      locale={locale}
      currentTimestamp={currentTimestamp}
      initialTag={initialTag}
      initialMainTag={initialMainTag}
    />
  )
}

async function RuntimeHomeInitialContent(props: HomeInitialContentProps) {
  await deferPublicShellPrerenderIfNeeded()
  const currentTimestamp = getHomeInitialCurrentTimestamp()

  return (
    <HomeInitialContentBody
      {...props}
      currentTimestamp={currentTimestamp}
    />
  )
}

export default async function HomeInitialContent({
  deferRuntimePrerender = true,
  ...props
}: HomeInitialContentProps) {
  if (shouldPrerenderPublicShell()) {
    const currentTimestamp = await getCachedHomeInitialCurrentTimestamp()

    return (
      <HomeInitialContentBody
        {...props}
        currentTimestamp={currentTimestamp}
      />
    )
  }

  if (!deferRuntimePrerender) {
    const currentTimestamp = getHomeInitialCurrentTimestamp()

    return (
      <HomeInitialContentBody
        {...props}
        currentTimestamp={currentTimestamp}
      />
    )
  }

  return <RuntimeHomeInitialContent {...props} />
}

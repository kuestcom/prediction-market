import type { SupportedLocale } from '@/i18n/locales'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getHomeInitialCurrentTimestamp } from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'
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

async function RuntimeHomeInitialContent(props: HomeInitialContentProps) {
  await deferPublicShellPrerenderIfNeeded()

  return <HomeInitialContentBody {...props} />
}

export default function HomeInitialContent({
  deferRuntimePrerender = true,
  ...props
}: HomeInitialContentProps) {
  if (shouldPrerenderPublicShell() || !deferRuntimePrerender) {
    return <HomeInitialContentBody {...props} />
  }

  return <RuntimeHomeInitialContent {...props} />
}

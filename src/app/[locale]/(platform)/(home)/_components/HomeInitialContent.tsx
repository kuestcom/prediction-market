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

async function RuntimeHomeInitialContent(props: HomeInitialContentProps) {
  await deferPublicShellPrerenderIfNeeded()
  return renderHomeContent(props)
}

function renderHomeContent(props: HomeInitialContentProps) {
  return (
    <HomeContent
      {...props}
      currentTimestamp={getHomeInitialCurrentTimestamp()}
    />
  )
}

export default async function HomeInitialContent({
  deferRuntimePrerender = true,
  ...props
}: HomeInitialContentProps) {
  if (shouldPrerenderPublicShell()) {
    return renderHomeContent(props)
  }

  if (!deferRuntimePrerender) {
    return renderHomeContent(props)
  }

  return <RuntimeHomeInitialContent {...props} />
}

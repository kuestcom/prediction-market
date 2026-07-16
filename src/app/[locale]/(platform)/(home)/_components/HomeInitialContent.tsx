import type { SupportedLocale } from '@/i18n/locales'
import type { CategoryFaqContext } from '@/lib/category-faq'
import { Suspense } from 'react'
import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getHomeInitialCurrentTimestamp } from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'
import { deferPublicShellPrerenderIfNeeded, shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'

interface HomeInitialContentProps {
  categoryFaqContext?: CategoryFaqContext
  deferRuntimePrerender?: boolean
  initialMainTag?: string
  initialTag?: string
  locale: SupportedLocale
}

async function RuntimeHomeInitialContent(props: HomeInitialContentProps) {
  await deferPublicShellPrerenderIfNeeded()
  return renderHomeContent(props, getHomeInitialCurrentTimestamp())
}

function renderHomeContent(props: HomeInitialContentProps, currentTimestamp: number | null) {
  return (
    <HomeContent
      {...props}
      currentTimestamp={currentTimestamp}
    />
  )
}

function renderPrerenderedHomeContent(props: HomeInitialContentProps, currentTimestamp: number | null) {
  return (
    <Suspense fallback={<HomeContentSkeleton />}>
      <HomeContent
        {...props}
        currentTimestamp={currentTimestamp}
      />
    </Suspense>
  )
}

function HomeContentSkeleton() {
  return (
    <main className="container grid gap-4 py-4">
      <EventsGridSkeleton />
    </main>
  )
}

export default async function HomeInitialContent({
  deferRuntimePrerender = true,
  ...props
}: HomeInitialContentProps) {
  if (shouldPrerenderPublicShell()) {
    return renderPrerenderedHomeContent(props, null)
  }

  if (!deferRuntimePrerender) {
    return renderHomeContent(props, getHomeInitialCurrentTimestamp())
  }

  return <RuntimeHomeInitialContent {...props} />
}

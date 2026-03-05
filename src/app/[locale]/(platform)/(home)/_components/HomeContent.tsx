'use cache'

import type { SupportedLocale } from '@/i18n/locales'
import type { CategoryPathSidebarSlug } from '@/lib/constants'
import type { Event } from '@/types'
import { cacheTag } from 'next/cache'
import HomeClient from '@/app/[locale]/(platform)/(home)/_components/HomeClient'
import { cacheTags } from '@/lib/cache-tags'
import { isCategoryPathSidebarSlug } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { TagRepository } from '@/lib/db/queries/tag'

interface HomeContentProps {
  locale: string
  initialTag?: string
  initialMainTag?: string
}

export default async function HomeContent({
  locale,
  initialTag,
  initialMainTag,
}: HomeContentProps) {
  cacheTag(cacheTags.eventsGlobal)
  const resolvedLocale = locale as SupportedLocale
  const initialTagSlug = initialTag ?? 'trending'
  const initialMainTagSlug = initialMainTag ?? initialTagSlug

  let initialEvents: Event[] = []
  let categorySidebar: {
    slug: CategoryPathSidebarSlug
    title: string
    childs: { name: string, slug: string }[]
  } | null = null

  try {
    const { data: events, error } = await EventRepository.listEvents({
      tag: initialTagSlug,
      search: '',
      userId: '',
      bookmarked: false,
      locale: resolvedLocale,
    })

    if (error) {
      console.warn('Failed to fetch initial events for static generation:', error)
    }
    else {
      initialEvents = events ?? []
    }
  }
  catch {
    initialEvents = []
  }

  if (isCategoryPathSidebarSlug(initialMainTagSlug)) {
    const { data: mainTags } = await TagRepository.getMainTags(resolvedLocale)
    const activeMainTag = mainTags?.find(tag => tag.slug === initialMainTagSlug)

    if (activeMainTag) {
      categorySidebar = {
        slug: initialMainTagSlug,
        title: activeMainTag.name,
        childs: activeMainTag.childs ?? [],
      }
    }
  }

  return (
    <main className="container grid gap-4 py-4">
      <HomeClient
        initialEvents={initialEvents}
        initialTag={initialTagSlug}
        initialMainTag={initialMainTagSlug}
        categorySidebar={categorySidebar}
      />
    </main>
  )
}

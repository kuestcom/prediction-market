'use client'

import type { CategoryPathSidebarSlug } from '@/lib/constants'
import type { Event } from '@/types'
import { useEffect, useRef } from 'react'
import CategorySidebar from '@/app/[locale]/(platform)/(home)/_components/CategorySidebar'
import { OpenCardProvider } from '@/app/[locale]/(platform)/(home)/_components/EventOpenCardProvider'
import EventsGrid from '@/app/[locale]/(platform)/(home)/_components/EventsGrid'
import FilterToolbar from '@/app/[locale]/(platform)/(home)/_components/FilterToolbar'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'

interface HomeClientProps {
  initialEvents: Event[]
  initialTag?: string
  initialMainTag?: string
  categorySidebar?: {
    slug: CategoryPathSidebarSlug
    title: string
    childs: { name: string, slug: string }[]
  } | null
}

export default function HomeClient({
  initialEvents,
  initialTag,
  initialMainTag,
  categorySidebar = null,
}: HomeClientProps) {
  const { filters, updateFilters } = useFilters()
  const lastAppliedInitialFiltersRef = useRef<string | null>(null)
  const hasCategorySidebar = categorySidebar !== null

  useEffect(() => {
    const targetTag = initialTag ?? 'trending'
    const targetMainTag = initialMainTag ?? targetTag
    const nextKey = `${targetMainTag}:${targetTag}`

    if (lastAppliedInitialFiltersRef.current === nextKey) {
      return
    }

    lastAppliedInitialFiltersRef.current = nextKey
    updateFilters({ tag: targetTag, mainTag: targetMainTag })
  }, [initialMainTag, initialTag, updateFilters])

  return (
    <>
      <div className="flex min-w-0 gap-6 lg:items-start lg:gap-10">
        {categorySidebar && (
          <CategorySidebar
            categorySlug={categorySidebar.slug}
            categoryTitle={categorySidebar.title}
            subcategories={categorySidebar.childs}
          />
        )}

        <div className="min-w-0 flex-1 space-y-4 lg:space-y-5">
          <FilterToolbar
            filters={filters}
            onFiltersChange={updateFilters}
            hideDesktopNavigationTags={hasCategorySidebar}
            desktopTitle={categorySidebar?.title}
          />

          <OpenCardProvider>
            <EventsGrid
              filters={filters}
              initialEvents={initialEvents}
              maxColumns={hasCategorySidebar ? 3 : undefined}
            />
          </OpenCardProvider>
        </div>
      </div>
    </>
  )
}

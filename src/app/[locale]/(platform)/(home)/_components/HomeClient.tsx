'use client'

import type { Route } from 'next'
import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event } from '@/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CategorySidebar from '@/app/[locale]/(platform)/(home)/_components/CategorySidebar'
import { OpenCardProvider } from '@/app/[locale]/(platform)/(home)/_components/EventOpenCardProvider'
import EventsGrid from '@/app/[locale]/(platform)/(home)/_components/EventsGrid'
import FilterToolbar from '@/app/[locale]/(platform)/(home)/_components/FilterToolbar'
import HomeSecondaryNavigation from '@/app/[locale]/(platform)/(home)/_components/HomeSecondaryNavigation'
import { DEFAULT_FILTERS, useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { usePathname, useRouter } from '@/i18n/navigation'
import { parsePlatformPathname, resolvePlatformNavigationSelection } from '@/lib/platform-navigation'
import { buildDynamicHomeCategorySlugSet } from '@/lib/platform-routing'

interface HomeClientProps {
  initialEvents: Event[]
  initialTag?: string
  initialMainTag?: string
}

function createHomeRouteFilters(targetTag: string, targetMainTag: string): FilterState {
  return {
    ...DEFAULT_FILTERS,
    tag: targetTag,
    mainTag: targetMainTag,
  }
}

export default function HomeClient({
  initialEvents,
  initialTag,
  initialMainTag,
}: HomeClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { updateFilters } = useFilters()
  const { tags, childParentMap } = usePlatformNavigationData()
  const lastAppliedRouteFiltersRef = useRef<string | null>(null)
  const dynamicHomeCategorySlugSet = useMemo(() => buildDynamicHomeCategorySlugSet(tags), [tags])
  const serverTargetTag = initialTag ?? 'trending'
  const serverTargetMainTag = initialMainTag ?? serverTargetTag
  const pathState = useMemo(
    () => parsePlatformPathname(pathname, dynamicHomeCategorySlugSet),
    [dynamicHomeCategorySlugSet, pathname],
  )
  const pathTargetTag = useMemo(() => {
    if (pathState.isHomePage) {
      return 'trending'
    }

    if (pathState.isMainTagPathPage && !pathState.isSportsPathPage) {
      return pathState.selectedSubtagPathSlug ?? pathState.selectedMainTagPathSlug ?? serverTargetTag
    }

    return serverTargetTag
  }, [pathState.isHomePage, pathState.isMainTagPathPage, pathState.isSportsPathPage, pathState.selectedMainTagPathSlug, pathState.selectedSubtagPathSlug, serverTargetTag])
  const pathTargetMainTag = useMemo(() => {
    if (pathState.isHomePage) {
      return 'trending'
    }

    if (pathState.isMainTagPathPage && !pathState.isSportsPathPage) {
      return pathState.selectedMainTagPathSlug ?? pathTargetTag
    }

    return serverTargetMainTag
  }, [pathState.isHomePage, pathState.isMainTagPathPage, pathState.isSportsPathPage, pathState.selectedMainTagPathSlug, pathTargetTag, serverTargetMainTag])
  const targetTag = pathState.isHomeLikePage && !pathState.isSportsPathPage ? pathTargetTag : serverTargetTag
  const targetMainTag = pathState.isHomeLikePage && !pathState.isSportsPathPage ? pathTargetMainTag : serverTargetMainTag
  const targetFilterKey = `${targetMainTag}:${targetTag}`
  const [homeFilters, setHomeFilters] = useState<FilterState>(() => createHomeRouteFilters(targetTag, targetMainTag))
  const hasPendingRouteFilterReset = lastAppliedRouteFiltersRef.current !== targetFilterKey
  const canUseServerInitialEvents = serverTargetTag === targetTag && serverTargetMainTag === targetMainTag
  const effectiveFilters = hasPendingRouteFilterReset
    ? createHomeRouteFilters(targetTag, targetMainTag)
    : homeFilters

  useEffect(() => {
    if (lastAppliedRouteFiltersRef.current === targetFilterKey) {
      return
    }

    lastAppliedRouteFiltersRef.current = targetFilterKey
    setHomeFilters(createHomeRouteFilters(targetTag, targetMainTag))
  }, [targetFilterKey, targetMainTag, targetTag])

  useEffect(() => {
    updateFilters({
      tag: effectiveFilters.tag,
      mainTag: effectiveFilters.mainTag,
      bookmarked: effectiveFilters.bookmarked,
    })
  }, [effectiveFilters.bookmarked, effectiveFilters.mainTag, effectiveFilters.tag, updateFilters])

  const handleFiltersChange = useCallback((updates: Partial<FilterState>) => {
    setHomeFilters(prev => ({ ...prev, ...updates }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setHomeFilters(createHomeRouteFilters(targetTag, targetMainTag))
  }, [targetMainTag, targetTag])

  const navigationSelection = useMemo(() => resolvePlatformNavigationSelection({
    dynamicHomeCategorySlugSet,
    pathname,
    filters: {
      tag: effectiveFilters.tag,
      mainTag: effectiveFilters.mainTag,
      bookmarked: effectiveFilters.bookmarked,
    },
    childParentMap,
  }), [childParentMap, dynamicHomeCategorySlugSet, effectiveFilters.bookmarked, effectiveFilters.mainTag, effectiveFilters.tag, pathname])

  const activeNavigationTag = useMemo(
    () => tags.find(tag => tag.slug === navigationSelection.activeMainTagSlug) ?? null,
    [navigationSelection.activeMainTagSlug, tags],
  )

  const showCategoryPathTitle = useMemo(() => (
    activeNavigationTag !== null
    && navigationSelection.pathState.isMainTagPathPage
    && navigationSelection.pathState.selectedMainTagPathSlug === activeNavigationTag.slug
    && dynamicHomeCategorySlugSet.has(activeNavigationTag.slug)
  ), [activeNavigationTag, dynamicHomeCategorySlugSet, navigationSelection.pathState.isMainTagPathPage, navigationSelection.pathState.selectedMainTagPathSlug])

  const categorySidebar = useMemo(() => {
    if (!activeNavigationTag || !showCategoryPathTitle || !dynamicHomeCategorySlugSet.has(activeNavigationTag.slug)) {
      return null
    }

    return {
      slug: activeNavigationTag.slug,
      title: activeNavigationTag.name,
      childs: activeNavigationTag.childs,
    }
  }, [activeNavigationTag, dynamicHomeCategorySlugSet, showCategoryPathTitle])

  const hasCategorySidebar = categorySidebar !== null
  const shouldUsePathSubcategoryNavigation = hasCategorySidebar
    && navigationSelection.pathState.selectedMainTagPathSlug === categorySidebar.slug

  const activeSecondaryTagSlug = useMemo(() => {
    if (!activeNavigationTag) {
      return 'trending'
    }

    const availableSlugs = new Set([
      activeNavigationTag.slug,
      ...activeNavigationTag.childs.map(child => child.slug),
    ])

    return availableSlugs.has(navigationSelection.activeTagSlug)
      ? navigationSelection.activeTagSlug
      : activeNavigationTag.slug
  }, [activeNavigationTag, navigationSelection.activeTagSlug])

  const activeSidebarSubcategorySlug = hasCategorySidebar && activeSecondaryTagSlug !== categorySidebar.slug
    ? activeSecondaryTagSlug
    : null

  const handleSecondaryNavigation = useCallback((targetTag: string) => {
    if (!activeNavigationTag) {
      return
    }

    if (shouldUsePathSubcategoryNavigation) {
      const nextPath = targetTag === activeNavigationTag.slug
        ? `/${activeNavigationTag.slug}`
        : `/${activeNavigationTag.slug}/${targetTag}`
      router.push(nextPath as Route)
      return
    }

    handleFiltersChange({ tag: targetTag, mainTag: activeNavigationTag.slug })
  }, [activeNavigationTag, handleFiltersChange, router, shouldUsePathSubcategoryNavigation])

  const secondaryNavigation = activeNavigationTag
    ? (
        <HomeSecondaryNavigation
          tag={activeNavigationTag}
          activeSubtagSlug={activeSecondaryTagSlug}
          showCategoryTitle={showCategoryPathTitle}
          hideOnDesktop={hasCategorySidebar}
          onSelectTag={handleSecondaryNavigation}
        />
      )
    : null

  return (
    <>
      <div className="flex min-w-0 gap-6 lg:items-start lg:gap-10">
        {categorySidebar && (
          <CategorySidebar
            categorySlug={categorySidebar.slug}
            categoryTitle={categorySidebar.title}
            activeSubcategorySlug={activeSidebarSubcategorySlug}
            onNavigate={handleSecondaryNavigation}
            subcategories={categorySidebar.childs}
          />
        )}

        <div className="min-w-0 flex-1 space-y-4 lg:space-y-5">
          <FilterToolbar
            filters={effectiveFilters}
            onFiltersChange={handleFiltersChange}
            hideDesktopSecondaryNavigation={hasCategorySidebar}
            desktopTitle={categorySidebar?.title}
            secondaryNavigation={secondaryNavigation}
          />

          <OpenCardProvider>
            <EventsGrid
              key={`${pathname}:${targetMainTag}:${targetTag}`}
              filters={effectiveFilters}
              initialEvents={canUseServerInitialEvents ? initialEvents : []}
              onClearFilters={handleClearFilters}
              routeMainTag={targetMainTag}
              routeTag={targetTag}
              maxColumns={hasCategorySidebar ? 3 : undefined}
            />
          </OpenCardProvider>
        </div>
      </div>
    </>
  )
}

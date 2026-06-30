'use client'

import type { Route } from 'next'
import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event, HomeFeaturedEventCard, HomeFeaturedHotTopic, HomeFeaturedSideCardSettings } from '@/types'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import EventsGrid from '@/app/[locale]/(platform)/(home)/_components/EventsGrid'
import FilterToolbar from '@/app/[locale]/(platform)/(home)/_components/FilterToolbar'
import HomeFeaturedEventsCarousel from '@/app/[locale]/(platform)/(home)/_components/HomeFeaturedEventsCarousel'
import HomeSecondaryNavigation from '@/app/[locale]/(platform)/(home)/_components/HomeSecondaryNavigation'
import { DEFAULT_FILTERS, useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { usePathname, useRouter } from '@/i18n/navigation'
import { getDefaultHomeRouteSortBy } from '@/lib/home-route-sort'
import { parsePlatformPathname, resolvePlatformNavigationSelection } from '@/lib/platform-navigation'
import { buildDynamicHomeCategorySlugSet } from '@/lib/platform-routing'

const CategorySidebar = dynamic(
  () => import('@/app/[locale]/(platform)/(home)/_components/CategorySidebar'),
)

interface HomeClientProps {
  initialEvents: Event[]
  initialFeaturedEvents: HomeFeaturedEventCard[]
  initialFeaturedHotTopics: HomeFeaturedHotTopic[]
  initialFeaturedSideCard: HomeFeaturedSideCardSettings
  initialCurrentTimestamp: number | null
  initialTag?: string
  initialMainTag?: string
}

function createHomeRouteFilters(targetTag: string, targetMainTag: string): FilterState {
  return {
    ...DEFAULT_FILTERS,
    tag: targetTag,
    mainTag: targetMainTag,
    sortBy: getDefaultHomeRouteSortBy(targetTag),
  }
}

function useHomeClientState({
  initialTag,
  initialMainTag,
}: Pick<HomeClientProps, 'initialTag' | 'initialMainTag'>) {
  const pathname = usePathname()
  const { tags, childParentMap } = usePlatformNavigationData()
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

  return {
    pathname,
    tags,
    childParentMap,
    dynamicHomeCategorySlugSet,
    serverTargetTag,
    serverTargetMainTag,
    pathState,
    targetTag,
    targetMainTag,
    targetFilterKey,
  }
}

export default function HomeClient({
  initialEvents,
  initialFeaturedEvents,
  initialFeaturedHotTopics,
  initialFeaturedSideCard,
  initialCurrentTimestamp,
  initialTag,
  initialMainTag,
}: HomeClientProps) {
  const {
    pathname,
    tags,
    childParentMap,
    dynamicHomeCategorySlugSet,
    serverTargetTag,
    serverTargetMainTag,
    pathState,
    targetTag,
    targetMainTag,
    targetFilterKey,
  } = useHomeClientState({
    initialTag,
    initialMainTag,
  })

  return (
    <HomeClientContent
      key={targetFilterKey}
      childParentMap={childParentMap}
      dynamicHomeCategorySlugSet={dynamicHomeCategorySlugSet}
      initialCurrentTimestamp={initialCurrentTimestamp}
      initialEvents={initialEvents}
      initialFeaturedEvents={initialFeaturedEvents}
      initialFeaturedHotTopics={initialFeaturedHotTopics}
      initialFeaturedSideCard={initialFeaturedSideCard}
      pathname={pathname}
      pathState={pathState}
      serverTargetMainTag={serverTargetMainTag}
      serverTargetTag={serverTargetTag}
      tags={tags}
      targetMainTag={targetMainTag}
      targetTag={targetTag}
    />
  )
}

interface HomeClientContentProps {
  childParentMap: ReturnType<typeof usePlatformNavigationData>['childParentMap']
  dynamicHomeCategorySlugSet: Set<string>
  initialCurrentTimestamp: number | null
  initialEvents: Event[]
  initialFeaturedEvents: HomeFeaturedEventCard[]
  initialFeaturedHotTopics: HomeFeaturedHotTopic[]
  initialFeaturedSideCard: HomeFeaturedSideCardSettings
  pathname: ReturnType<typeof usePathname>
  pathState: ReturnType<typeof parsePlatformPathname>
  serverTargetMainTag: string
  serverTargetTag: string
  tags: ReturnType<typeof usePlatformNavigationData>['tags']
  targetMainTag: string
  targetTag: string
}

type HomeClientContentStateInput = Pick<HomeClientContentProps, | 'childParentMap'
  | 'dynamicHomeCategorySlugSet'
  | 'pathname'
  | 'serverTargetMainTag'
  | 'serverTargetTag'
  | 'tags'
  | 'targetMainTag'
  | 'targetTag'>

function useHomeClientContentState({
  childParentMap,
  dynamicHomeCategorySlugSet,
  pathname,
  serverTargetMainTag,
  serverTargetTag,
  tags,
  targetMainTag,
  targetTag,
}: HomeClientContentStateInput) {
  const router = useRouter()
  const { updateFilters } = useFilters()
  const [homeFilters, setHomeFilters] = useState<FilterState>(() => createHomeRouteFilters(targetTag, targetMainTag))
  const canUseServerInitialEvents = useMemo(
    () => serverTargetTag === targetTag && serverTargetMainTag === targetMainTag,
    [serverTargetMainTag, serverTargetTag, targetMainTag, targetTag],
  )

  useEffect(function syncHomeFiltersToGlobalFilterStore() {
    updateFilters({
      tag: homeFilters.tag,
      mainTag: homeFilters.mainTag,
      bookmarked: homeFilters.bookmarked,
    })
  }, [homeFilters.bookmarked, homeFilters.mainTag, homeFilters.tag, updateFilters])

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
      tag: homeFilters.tag,
      mainTag: homeFilters.mainTag,
      bookmarked: homeFilters.bookmarked,
    },
    childParentMap,
  }), [childParentMap, dynamicHomeCategorySlugSet, homeFilters.bookmarked, homeFilters.mainTag, homeFilters.tag, pathname])

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
      sidebarItems: activeNavigationTag.sidebarItems,
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

  const handleSecondaryNavigation = useCallback(({ slug: targetTag, href }: { href?: string, slug: string }) => {
    if (!activeNavigationTag) {
      return
    }

    if (href) {
      router.push(href as Route)
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

  return {
    homeFilters,
    canUseServerInitialEvents,
    handleFiltersChange,
    handleClearFilters,
    hasCategorySidebar,
    categorySidebar,
    activeSidebarSubcategorySlug,
    secondaryNavigation,
    handleSecondaryNavigation,
  }
}

function HomeClientContent({
  childParentMap,
  dynamicHomeCategorySlugSet,
  initialCurrentTimestamp,
  initialEvents,
  initialFeaturedEvents,
  initialFeaturedHotTopics,
  initialFeaturedSideCard,
  pathname,
  pathState,
  serverTargetMainTag,
  serverTargetTag,
  tags,
  targetMainTag,
  targetTag,
}: HomeClientContentProps) {
  const t = useExtracted()
  const {
    homeFilters,
    canUseServerInitialEvents,
    handleFiltersChange,
    handleClearFilters,
    hasCategorySidebar,
    categorySidebar,
    activeSidebarSubcategorySlug,
    secondaryNavigation,
    handleSecondaryNavigation,
  } = useHomeClientContentState({
    childParentMap,
    dynamicHomeCategorySlugSet,
    pathname,
    serverTargetMainTag,
    serverTargetTag,
    tags,
    targetMainTag,
    targetTag,
  })
  const hasFeaturedEvents = pathState.isHomePage && initialFeaturedEvents.length > 0

  return (
    <>
      <div className="flex min-w-0 gap-6 lg:items-start lg:gap-10">
        {categorySidebar && (
          <CategorySidebar
            categorySlug={categorySidebar.slug}
            categoryTitle={categorySidebar.title}
            activeSubcategorySlug={activeSidebarSubcategorySlug}
            onNavigate={handleSecondaryNavigation}
            sidebarItems={categorySidebar.sidebarItems}
            subcategories={categorySidebar.childs}
          />
        )}

        <div className="min-w-0 flex-1 space-y-4 lg:space-y-5">
          {hasFeaturedEvents && (
            <HomeFeaturedEventsCarousel
              hotTopics={initialFeaturedHotTopics}
              items={initialFeaturedEvents}
              sideCard={initialFeaturedSideCard}
            />
          )}

          {hasFeaturedEvents
            ? (
                <div className="grid gap-3">
                  <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h1 className="shrink-0 text-2xl font-semibold tracking-tight">
                      {t('All markets')}
                    </h1>

                    <div className="min-w-0 md:max-w-xl">
                      <FilterToolbar
                        filters={homeFilters}
                        onFiltersChange={handleFiltersChange}
                        showFilterCheckboxes={pathState.isHomePage}
                      />
                    </div>
                  </div>

                  {secondaryNavigation}
                </div>
              )
            : (
                <FilterToolbar
                  filters={homeFilters}
                  onFiltersChange={handleFiltersChange}
                  hideDesktopSecondaryNavigation={hasCategorySidebar}
                  desktopTitle={categorySidebar?.title}
                  secondaryNavigation={secondaryNavigation}
                  showFilterCheckboxes={pathState.isHomePage}
                />
              )}

          <EventsGrid
            filters={homeFilters}
            initialEvents={canUseServerInitialEvents ? initialEvents : []}
            initialCurrentTimestamp={initialCurrentTimestamp}
            onClearFilters={handleClearFilters}
            routeMainTag={targetMainTag}
            routeTag={targetTag}
            maxColumns={hasCategorySidebar ? 3 : undefined}
          />
        </div>
      </div>
    </>
  )
}

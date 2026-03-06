'use client'

import type { Route } from 'next'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import NavigationMoreMenu from '@/app/[locale]/(platform)/_components/NavigationMoreMenu'
import NavigationTab from '@/app/[locale]/(platform)/_components/NavigationTab'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { usePathname } from '@/i18n/navigation'
import { resolvePlatformNavigationSelection } from '@/lib/platform-navigation'
import { buildDynamicHomeCategorySlugSet, isPlatformReservedRootSlug } from '@/lib/platform-routing'
import { cn } from '@/lib/utils'

function getMainTagHref(slug: string, dynamicHomeCategorySlugSet: ReadonlySet<string>): Route {
  if (slug === 'trending') {
    return '/' as Route
  }

  if (slug === 'new' || isPlatformReservedRootSlug(slug) || dynamicHomeCategorySlugSet.has(slug)) {
    return `/${slug}` as Route
  }

  return '/' as Route
}

export default function NavigationTabs() {
  const pathname = usePathname()
  const { filters } = useFilters()
  const { tags, childParentMap } = usePlatformNavigationData()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tabItemRef = useRef<(HTMLSpanElement | null)[]>([])
  const [showLeftShadow, setShowLeftShadow] = useState(false)
  const [showRightShadow, setShowRightShadow] = useState(false)
  const dynamicHomeCategorySlugSet = useMemo(() => buildDynamicHomeCategorySlugSet(tags), [tags])

  const navigationSelection = useMemo(() => resolvePlatformNavigationSelection({
    dynamicHomeCategorySlugSet,
    pathname,
    filters: {
      tag: filters.tag,
      mainTag: filters.mainTag,
      bookmarked: filters.bookmarked,
    },
    childParentMap,
  }), [childParentMap, dynamicHomeCategorySlugSet, filters.bookmarked, filters.mainTag, filters.tag, pathname])

  const activeIndex = useMemo(
    () => tags.findIndex(tag => tag.slug === navigationSelection.activeMainTagSlug),
    [navigationSelection.activeMainTagSlug, tags],
  )

  const updateScrollShadows = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      setShowLeftShadow(false)
      setShowRightShadow(false)
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScrollLeft = scrollWidth - clientWidth

    setShowLeftShadow(scrollLeft > 4)
    setShowRightShadow(scrollLeft < maxScrollLeft - 4)
  }, [])

  useEffect(() => {
    tabItemRef.current = Array.from({ length: tags.length }).map((_, index) => tabItemRef.current[index] ?? null)
  }, [tags.length])

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      updateScrollShadows()
    })

    return () => cancelAnimationFrame(rafId)
  }, [updateScrollShadows])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let resizeTimeout: NodeJS.Timeout

    function handleResize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        updateScrollShadows()
      }, 16)
    }

    function handleScroll() {
      updateScrollShadows()
    }

    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [updateScrollShadows])

  useEffect(() => {
    if (activeIndex < 0) {
      return
    }

    const activeTab = tabItemRef.current[activeIndex]
    if (!activeTab) {
      return
    }

    const timeoutId = setTimeout(() => {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [activeIndex])

  return (
    <nav className="sticky top-15 z-20 bg-background md:top-17">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />
      <div className="container mx-auto flex w-full min-w-0">
        <div
          id="navigation-main-tags"
          ref={containerRef}
          className={cn(
            `
              flex h-12 w-full min-w-0 snap-x snap-mandatory scroll-px-3 items-center overflow-x-auto text-sm
              font-medium
            `,
            showLeftShadow && showRightShadow
            && `
              mask-[linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]
              [-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]
            `,
            showLeftShadow && !showRightShadow
            && `
              mask-[linear-gradient(to_right,transparent,black_32px,black)]
              [-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black)]
            `,
            showRightShadow && !showLeftShadow
            && `
              mask-[linear-gradient(to_right,black,black_calc(100%-32px),transparent)]
              [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]
            `,
          )}
        >
          {tags.map((tag, index) => (
            <div key={tag.slug} className="flex snap-start items-center">
              <NavigationTab
                tag={tag}
                href={getMainTagHref(tag.slug, dynamicHomeCategorySlugSet)}
                isActive={navigationSelection.activeMainTagSlug === tag.slug}
                tabPaddingClass={index === 0 ? 'px-2.5 pl-0' : 'px-3'}
                containerRef={(element) => {
                  tabItemRef.current[index] = element
                }}
              />

              {index === 1 && <div className="mx-3 h-5 w-px shrink-0 bg-border" />}
            </div>
          ))}

          <div className="flex snap-start items-center">
            <NavigationMoreMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}

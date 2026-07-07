'use client'

import type { PlatformCategorySidebarLinkItem, PlatformNavigationTag } from '@/lib/platform-navigation'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  resolveHorizontalScrollMaskClass,
  useHorizontalScrollShadows,
  useScrollActiveItemIntoView,
} from '@/hooks/useHorizontalScrollState'
import { cn } from '@/lib/utils'

interface HomeSecondaryNavigationProps {
  activeSubtagSlug: string
  hideOnDesktop?: boolean
  onSelectTag: (target: Pick<PlatformCategorySidebarLinkItem, 'href' | 'slug'>) => void
  showCategoryTitle?: boolean
  tag: Pick<PlatformNavigationTag, 'childs' | 'name' | 'sidebarItems' | 'slug'>
}

interface TagItem {
  href: string | undefined
  slug: string
  label: string
}

interface UseResolvedTagItemsParams {
  tag: Pick<PlatformNavigationTag, 'childs' | 'sidebarItems' | 'slug'>
  activeSubtagSlug: string
}

function useResolvedTagItems({ tag, activeSubtagSlug }: UseResolvedTagItemsParams) {
  const t = useExtracted()
  const tagItems = useMemo<TagItem[]>(() => {
    if (tag.sidebarItems) {
      return tag.sidebarItems
        .filter(item => item.type === 'link')
        .map(item => ({
          href: item.href,
          slug: item.slug,
          label: item.isAll ? t('All') : item.label,
        }))
    }

    return [
      { href: undefined, slug: tag.slug, label: t('All') },
      ...tag.childs.map(child => ({ href: undefined, slug: child.slug, label: child.name })),
    ]
  }, [tag.childs, tag.sidebarItems, tag.slug, t])

  const resolvedActiveSubtagSlug = useMemo(
    () => (tagItems.some(item => item.slug === activeSubtagSlug) ? activeSubtagSlug : tag.slug),
    [activeSubtagSlug, tag.slug, tagItems],
  )

  return { tagItems, resolvedActiveSubtagSlug }
}

interface UseTagNavigationParams {
  tagItems: TagItem[]
  resolvedActiveSubtagSlug: string
}

function useTagNavigation({ tagItems, resolvedActiveSubtagSlug }: UseTagNavigationParams) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<(HTMLButtonElement | null)[]>([])
  const indicatorRetryRef = useRef<number | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [indicatorReady, setIndicatorReady] = useState(false)

  const cancelIndicatorRetry = useCallback(() => {
    if (indicatorRetryRef.current !== null) {
      cancelAnimationFrame(indicatorRetryRef.current)
      indicatorRetryRef.current = null
    }
  }, [])

  const updateIndicator = useCallback(() => {
    function applyIndicatorPosition() {
      const activeIndex = tagItems.findIndex(item => item.slug === resolvedActiveSubtagSlug)
      const activeButton = buttonRef.current[activeIndex]

      if (!activeButton) {
        if (indicatorRetryRef.current === null) {
          indicatorRetryRef.current = requestAnimationFrame(() => {
            indicatorRetryRef.current = null
            applyIndicatorPosition()
          })
        }
        return
      }

      cancelIndicatorRetry()

      const { offsetLeft, offsetWidth } = activeButton
      setIndicatorStyle((current) => {
        if (current.left === offsetLeft && current.width === offsetWidth) {
          return current
        }

        return { left: offsetLeft, width: offsetWidth }
      })
      setIndicatorReady(current => current || true)
    }

    applyIndicatorPosition()
  }, [cancelIndicatorRetry, resolvedActiveSubtagSlug, tagItems])

  useEffect(function syncButtonRefArrayLength() {
    buttonRef.current = Array.from({ length: tagItems.length }).map((_, index) => buttonRef.current[index] ?? null)
  }, [tagItems.length])

  const activeIndex = useMemo(
    () => tagItems.findIndex(item => item.slug === resolvedActiveSubtagSlug),
    [resolvedActiveSubtagSlug, tagItems],
  )
  const {
    showLeftShadow,
    showRightShadow,
    updateScrollShadows,
  } = useHorizontalScrollShadows({
    containerRef: scrollContainerRef,
    onResize: updateIndicator,
  })

  useLayoutEffect(function repaintNavigationOnLayout() {
    const rafId = requestAnimationFrame(() => {
      updateScrollShadows()
      updateIndicator()
    })

    return function cleanupNavigationLayoutPaint() {
      cancelAnimationFrame(rafId)
      cancelIndicatorRetry()
    }
  }, [cancelIndicatorRetry, updateIndicator, updateScrollShadows])

  useEffect(function cancelPendingIndicatorRetryOnUnmount() {
    return cancelIndicatorRetry
  }, [cancelIndicatorRetry])

  const activeScrollKey = useMemo(
    () => `${resolvedActiveSubtagSlug}:${tagItems.map(item => item.slug).join('|')}`,
    [resolvedActiveSubtagSlug, tagItems],
  )

  useScrollActiveItemIntoView({
    activeIndex,
    containerRef: scrollContainerRef,
    itemRef: buttonRef,
    dependencyKey: activeScrollKey,
  })

  return {
    scrollContainerRef,
    buttonRef,
    showLeftShadow,
    showRightShadow,
    indicatorStyle,
    indicatorReady,
  }
}

export default function HomeSecondaryNavigation({
  tag,
  activeSubtagSlug,
  onSelectTag,
  showCategoryTitle = false,
  hideOnDesktop = false,
}: HomeSecondaryNavigationProps) {
  const { tagItems, resolvedActiveSubtagSlug } = useResolvedTagItems({ tag, activeSubtagSlug })
  const {
    scrollContainerRef,
    buttonRef,
    showLeftShadow,
    showRightShadow,
    indicatorStyle,
    indicatorReady,
  } = useTagNavigation({ tagItems, resolvedActiveSubtagSlug })

  return (
    <div className="flex w-full max-w-full min-w-0 items-center gap-2">
      {showCategoryTitle && (
        <h1 className={cn('pr-6 text-xl font-medium', hideOnDesktop && 'lg:hidden')}>
          {tag.name}
        </h1>
      )}

      <div className={cn('relative min-w-0 flex-1', hideOnDesktop && 'lg:hidden')}>
        <div
          ref={scrollContainerRef}
          className={cn(
            'relative flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto',
            resolveHorizontalScrollMaskClass({ showLeftShadow, showRightShadow }),
          )}
        >
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 rounded-sm bg-primary/30',
              { 'transition-all duration-300 ease-out': indicatorReady },
            )}
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorReady ? 1 : 0,
            }}
          />

          {tagItems.map((item, index) => (
            <Button
              key={item.slug}
              ref={(element: HTMLButtonElement | null) => {
                buttonRef.current[index] = element
              }}
              onClick={() => onSelectTag({ slug: item.slug, href: item.href })}
              variant="ghost"
              size="sm"
              className={cn(
                'relative z-10 h-8 shrink-0 bg-transparent text-sm whitespace-nowrap',
                'hover:bg-transparent dark:hover:bg-transparent',
                resolvedActiveSubtagSlug === item.slug
                  ? 'text-primary hover:text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

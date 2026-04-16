'use client'

import type { PlatformCategorySidebarLinkItem, PlatformNavigationTag } from '@/lib/platform-navigation'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
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
  const [showLeftShadow, setShowLeftShadow] = useState(false)
  const [showRightShadow, setShowRightShadow] = useState(false)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [indicatorReady, setIndicatorReady] = useState(false)

  const cancelIndicatorRetry = useCallback(() => {
    if (indicatorRetryRef.current !== null) {
      cancelAnimationFrame(indicatorRetryRef.current)
      indicatorRetryRef.current = null
    }
  }, [])

  const updateScrollShadows = useCallback(() => {
    const container = scrollContainerRef.current
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
      queueMicrotask(() => {
        setIndicatorStyle({ left: offsetLeft, width: offsetWidth })
        setIndicatorReady(true)
      })
    }

    applyIndicatorPosition()
  }, [cancelIndicatorRetry, resolvedActiveSubtagSlug, tagItems])

  useEffect(function syncButtonRefArrayLength() {
    buttonRef.current = Array.from({ length: tagItems.length }).map((_, index) => buttonRef.current[index] ?? null)
  }, [tagItems.length])

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

  useEffect(function reactNavigationToScrollAndResize() {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    let resizeTimeout: NodeJS.Timeout

    function handleResize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        updateScrollShadows()
        updateIndicator()
      }, 16)
    }

    function handleScroll() {
      updateScrollShadows()
    }

    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    return function detachNavigationScrollResizeListeners() {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [updateIndicator, updateScrollShadows])

  useEffect(function scrollActiveTagIntoView() {
    const activeIndex = tagItems.findIndex(item => item.slug === resolvedActiveSubtagSlug)
    if (activeIndex < 0) {
      return
    }

    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const activeButton = buttonRef.current[activeIndex]
    if (!activeButton) {
      return
    }

    const timeoutId = setTimeout(() => {
      const containerRect = container.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()
      const currentLeft = buttonRect.left - containerRect.left + container.scrollLeft
      const targetLeft = currentLeft - (containerRect.width / 2) + (buttonRect.width / 2)
      const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth)
      const clampedLeft = Math.min(Math.max(0, targetLeft), maxLeft)

      container.scrollTo({ left: clampedLeft, behavior: 'smooth' })
    }, 100)

    return function cancelScrollActiveTagIntoView() {
      clearTimeout(timeoutId)
    }
  }, [resolvedActiveSubtagSlug, tagItems])

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

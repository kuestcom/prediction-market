'use client'

import type { Route } from 'next'
import { TrendingUpIcon } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { Teleport } from '@/components/Teleport'
import { Button } from '@/components/ui/button'
import { Link, redirect, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface NavigationTabProps {
  tag: {
    slug: string
    name: string
    childs: { name: string, slug: string }[]
  }
  childParentMap: Record<string, string>
}

export default function NavigationTab({ tag, childParentMap }: NavigationTabProps) {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const { filters, updateFilters } = useFilters()

  const showBookmarkedOnly = isHomePage ? filters.bookmarked : false
  const tagFromFilters = isHomePage
    ? (showBookmarkedOnly && filters.tag === 'trending' ? '' : filters.tag)
    : pathname === '/mentions' ? 'mentions' : 'trending'
  const mainTagFromFilters = isHomePage
    ? (filters.mainTag || childParentMap[tagFromFilters] || tagFromFilters || 'trending')
    : pathname === '/mentions' ? 'mentions' : 'trending'

  const isActive = mainTagFromFilters === tag.slug

  const [showLeftShadow, setShowLeftShadow] = useState(false)
  const [showRightShadow, setShowRightShadow] = useState(false)
  const [showParentLeftShadow, setShowParentLeftShadow] = useState(false)
  const [showParentRightShadow, setShowParentRightShadow] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const mainTabRef = useRef<HTMLButtonElement>(null)
  const parentScrollContainerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [indicatorReady, setIndicatorReady] = useState(false)
  const indicatorRetryRef = useRef<number | null>(null)

  const tagItems = useMemo(() => {
    return [
      { slug: tag.slug, label: 'All' },
      ...tag.childs.map(child => ({ slug: child.slug, label: child.name })),
    ]
  }, [tag.slug, tag.childs])
  const activeSubtagSlug = useMemo(
    () => (tagItems.some(item => item.slug === tagFromFilters) ? tagFromFilters : tag.slug),
    [tag.slug, tagFromFilters, tagItems],
  )

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
    if (!isActive) {
      if (indicatorRetryRef.current !== null) {
        cancelAnimationFrame(indicatorRetryRef.current)
        indicatorRetryRef.current = null
      }
      setIndicatorReady(false)
      return
    }

    const activeIndex = tagItems.findIndex(item => item.slug === activeSubtagSlug)
    const activeButton = buttonRefs.current[activeIndex]

    if (!activeButton) {
      if (indicatorRetryRef.current === null) {
        indicatorRetryRef.current = requestAnimationFrame(() => {
          indicatorRetryRef.current = null
          updateIndicator()
        })
      }
      return
    }

    const { offsetLeft, offsetWidth } = activeButton
    queueMicrotask(() => {
      setIndicatorStyle({ left: offsetLeft, width: offsetWidth })
      setIndicatorReady(true)
    })
  }, [activeSubtagSlug, isActive, tagItems])

  const updateParentScrollShadows = useCallback(() => {
    const parentContainer = parentScrollContainerRef.current
    if (!parentContainer) {
      setShowParentLeftShadow(false)
      setShowParentRightShadow(false)
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = parentContainer
    const maxScrollLeft = scrollWidth - clientWidth

    setShowParentLeftShadow(scrollLeft > 4)
    setShowParentRightShadow(scrollLeft < maxScrollLeft - 4)
  }, [])

  useEffect(() => {
    buttonRefs.current = Array.from({ length: tagItems.length }).map((_, index) => buttonRefs.current[index] ?? null)
  }, [tagItems.length])

  useEffect(() => {
    const parentContainer = document.getElementById('navigation-main-tags') as HTMLDivElement
    if (parentContainer) {
      parentScrollContainerRef.current = parentContainer
    }
  }, [])

  useLayoutEffect(() => {
    if (!isActive) {
      setShowLeftShadow(false)
      setShowRightShadow(false)
      return
    }

    const rafId = requestAnimationFrame(() => {
      updateScrollShadows()
    })

    return () => cancelAnimationFrame(rafId)
  }, [isActive, updateScrollShadows, tag.childs.length])

  useLayoutEffect(() => {
    updateIndicator()
  }, [updateIndicator])

  useEffect(() => {
    if (!isActive) {
      return
    }
    const rafId = requestAnimationFrame(() => {
      updateIndicator()
    })
    return () => cancelAnimationFrame(rafId)
  }, [isActive, updateIndicator, tagItems.length])

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      updateParentScrollShadows()
    })

    return () => cancelAnimationFrame(rafId)
  }, [updateParentScrollShadows])

  useEffect(() => {
    const parentContainer = parentScrollContainerRef.current
    if (!parentContainer || tag.slug !== 'trending') {
      return
    }

    const maskClasses = []

    if (showParentLeftShadow || showParentRightShadow) {
      if (showParentLeftShadow && showParentRightShadow) {
        maskClasses.push(
          '[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
          '[-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
        )
      }
      else if (showParentLeftShadow && !showParentRightShadow) {
        maskClasses.push(
          '[mask-image:linear-gradient(to_right,transparent,black_32px,black)]',
          '[-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black)]',
        )
      }
      else if (showParentRightShadow && !showParentLeftShadow) {
        maskClasses.push(
          '[mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]',
          '[-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]',
        )
      }
    }

    parentContainer.classList.remove(
      '[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
      '[-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
      '[mask-image:linear-gradient(to_right,transparent,black_32px,black)]',
      '[-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black)]',
      '[mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]',
      '[-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]',
    )

    if (maskClasses.length > 0) {
      parentContainer.classList.add(...maskClasses)
    }

    return () => {
      parentContainer.classList.remove(
        '[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
        '[-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
        '[mask-image:linear-gradient(to_right,transparent,black_32px,black)]',
        '[-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black)]',
        '[mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]',
        '[-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]',
      )
    }
  }, [showParentLeftShadow, showParentRightShadow, tag.slug])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const childIndex = tag.childs.findIndex(child => child.slug === tagFromFilters)
    if (childIndex < 0) {
      return
    }

    const buttonIndex = childIndex + 1
    const activeButton = buttonRefs.current[buttonIndex]

    if (!activeButton) {
      const timeoutId = setTimeout(() => {
        const retryButton = buttonRefs.current[buttonIndex]
        if (retryButton) {
          retryButton.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        }
      }, 1000)
      return () => clearTimeout(timeoutId)
    }

    const timeoutId = setTimeout(() => {
      activeButton.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isActive, tagFromFilters, tag.childs])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const mainTab = mainTabRef.current
    if (!mainTab) {
      return
    }

    const timeoutId = setTimeout(() => {
      mainTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isActive])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !isActive) {
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

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [updateScrollShadows, updateIndicator, isActive])

  useEffect(() => {
    const parentContainer = parentScrollContainerRef.current
    if (!parentContainer) {
      return
    }

    let resizeTimeout: NodeJS.Timeout
    function handleResize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        updateParentScrollShadows()
      }, 16)
    }

    function handleScroll() {
      updateParentScrollShadows()
    }

    parentContainer.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    return () => {
      parentContainer.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [updateParentScrollShadows])

  const handleTagClick = useCallback((targetTag: string, parentTag?: string) => {
    if (targetTag === 'mentions') {
      // @ts-expect-error next-intl
      redirect('/mentions')
    }

    updateFilters({ tag: targetTag, mainTag: parentTag ?? targetTag })
  }, [updateFilters])

  return (
    <>
      {tag.slug === 'mentions' && (
        <Link
          href="/mentions"
          className={`
  flex cursor-pointer items-center gap-1.5 border-b-2 py-2 pb-1 whitespace-nowrap transition-colors
  ${
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
        >
          <span>{tag.name}</span>
        </Link>
      )}

      {tag.slug !== 'mentions' && (
        <span ref={mainTabRef}>
          <Link
            href={'/' as Route}
            onClick={() => handleTagClick(tag.slug)}
            className={`flex cursor-pointer items-center gap-1.5 border-b-2 py-2 pb-1 whitespace-nowrap transition-colors ${
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tag.slug === 'trending' && <TrendingUpIcon className="size-4" />}
            <span>{tag.name}</span>
          </Link>
        </span>
      )}

      {isActive && (
        <Teleport to="#navigation-tags">
          <div className="relative w-full max-w-full">
            <div
              ref={scrollContainerRef}
              className={cn(
                'relative scrollbar-hide flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto',
                (showLeftShadow || showRightShadow)
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
                  indicatorReady && 'transition-all duration-300 ease-out',
                )}
                style={{
                  left: `${indicatorStyle.left}px`,
                  width: `${indicatorStyle.width}px`,
                  opacity: indicatorReady ? 1 : 0,
                }}
              />
              <Button
                ref={(el: HTMLButtonElement | null) => {
                  buttonRefs.current[0] = el
                }}
                onClick={() => handleTagClick(tag.slug, tag.slug)}
                variant="ghost"
                size="sm"
                className={cn(
                  'relative h-8 shrink-0 bg-transparent text-sm whitespace-nowrap',
                  'hover:bg-transparent dark:hover:bg-transparent',
                  activeSubtagSlug === tag.slug
                    ? 'text-primary hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                All
              </Button>

              {tag.childs.map((subtag, index) => (
                <Button
                  key={subtag.slug}
                  ref={(el: HTMLButtonElement | null) => {
                    buttonRefs.current[index + 1] = el
                  }}
                  onClick={() => handleTagClick(subtag.slug, tag.slug)}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'relative z-10 h-8 shrink-0 bg-transparent text-sm whitespace-nowrap',
                    'hover:bg-transparent dark:hover:bg-transparent',
                    activeSubtagSlug === subtag.slug
                      ? 'text-primary hover:text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {subtag.name}
                </Button>
              ))}
            </div>
          </div>
        </Teleport>
      )}
    </>
  )
}

'use client'

import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import EventRelatedSkeleton from '@/app/[locale]/(platform)/event/[slug]/_components/EventRelatedSkeleton'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface EventRelatedProps {
  event: Event
}

interface BackgroundStyle {
  left: number
  width: number
  height: number
  top: number
  isInitialized: boolean
}

interface RelatedEvent {
  id: string
  slug: string
  title: string
  icon_url: string
  chance: number | null
}

interface UseRelatedEventsParams {
  eventSlug: string
  tag?: string
  enabled?: boolean
}

const INITIAL_BACKGROUND_STYLE: BackgroundStyle = {
  left: 0,
  width: 0,
  height: 0,
  top: 0,
  isInitialized: false,
}

async function fetchRelatedEvents(params: UseRelatedEventsParams): Promise<RelatedEvent[]> {
  const { eventSlug, tag } = params

  const url = new URL(`/api/events/${eventSlug}/related`, window.location.origin)
  if (tag && tag !== 'all') {
    url.searchParams.set('tag', tag)
  }

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error('Failed to fetch related events.')
  }

  return response.json()
}

function useRelatedEvents(params: UseRelatedEventsParams) {
  const { eventSlug, tag = 'all', enabled = true } = params

  const queryKey = ['related-events', eventSlug, tag] as const

  return useQuery({
    queryKey,
    queryFn: () => fetchRelatedEvents({ eventSlug, tag }),
    enabled,
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    retry: 3,
  })
}

export default function EventRelated({ event }: EventRelatedProps) {
  const t = useExtracted()
  const [activeTag, setActiveTagState] = useState('all')
  const [backgroundStyle, setBackgroundStyleState] = useState<BackgroundStyle>(INITIAL_BACKGROUND_STYLE)
  const [showLeftShadow, setShowLeftShadowState] = useState(false)
  const [showRightShadow, setShowRightShadowState] = useState(false)

  const { data: events = [], isLoading: loading, error } = useRelatedEvents({
    eventSlug: event.slug,
    tag: activeTag,
  })

  function resetActiveTag() {
    setActiveTagState('all')
  }

  function resetBackgroundStyle() {
    setBackgroundStyleState({ ...INITIAL_BACKGROUND_STYLE })
  }

  function applyBackgroundStyle(style: BackgroundStyle) {
    setBackgroundStyleState(style)
  }

  function updateScrollShadowState(left: boolean, right: boolean) {
    setShowLeftShadowState(left)
    setShowRightShadowState(right)
  }
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const buttonsWrapperRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const tagItems = useMemo(() => {
    const uniqueTags = new Map<string, string>()

    if (event.tags && event.tags.length > 0) {
      for (const tag of event.tags) {
        if (!tag.slug || uniqueTags.has(tag.slug)) {
          continue
        }

        const tagLabel = tag.name?.trim()
        if (tagLabel === 'Hide From New') {
          continue
        }

        uniqueTags.set(tag.slug, tagLabel ?? tag.slug)
      }
    }

    return [
      { slug: 'all', label: t('All') },
      ...Array.from(uniqueTags.entries()).map(([slug, label]) => ({
        slug,
        label,
      })),
    ]
  }, [event.tags, t])

  const activeIndex = useMemo(
    () => tagItems.findIndex(item => item.slug === activeTag),
    [activeTag, tagItems],
  )

  useEffect(() => {
    resetActiveTag()
  }, [event.slug])

  useEffect(() => {
    buttonRefs.current = Array.from({ length: tagItems.length }).map((_, index) => buttonRefs.current[index] ?? null)
  }, [tagItems.length])

  const updateBackgroundPosition = useCallback(() => {
    if (activeIndex === -1) {
      resetBackgroundStyle()
      return
    }

    const activeButton = buttonRefs.current[activeIndex]
    const container = buttonsWrapperRef.current

    if (!activeButton || !container) {
      return
    }

    requestAnimationFrame(() => {
      const buttonRect = activeButton.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      const left = buttonRect.left - containerRect.left
      const top = buttonRect.top - containerRect.top

      applyBackgroundStyle({
        left,
        width: buttonRect.width,
        height: buttonRect.height,
        top,
        isInitialized: true,
      })
    })
  }, [activeIndex])

  const updateScrollShadows = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) {
      updateScrollShadowState(false, false)
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScrollLeft = scrollWidth - clientWidth

    updateScrollShadowState(scrollLeft > 4, scrollLeft < maxScrollLeft - 4)
  }, [])

  useLayoutEffect(() => {
    updateBackgroundPosition()
  }, [updateBackgroundPosition, tagItems.length, activeIndex])

  useEffect(() => {
    const container = scrollContainerRef.current
    updateScrollShadows()

    if (!container) {
      return
    }

    let resizeTimeout: NodeJS.Timeout
    function handleResize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        updateBackgroundPosition()
        updateScrollShadows()
      }, 16)
    }

    function handleScroll() {
      updateScrollShadows()
      updateBackgroundPosition()
    }

    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [updateBackgroundPosition, updateScrollShadows, tagItems.length])

  useEffect(() => {
    if (activeIndex < 0) {
      return
    }

    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const activeButton = buttonRefs.current[activeIndex]
    if (!activeButton) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    const targetLeft = activeButton.offsetLeft - (containerRect.width / 2) + (buttonRect.width / 2)
    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth)
    const clampedLeft = Math.min(Math.max(0, targetLeft), maxLeft)

    container.scrollTo({ left: clampedLeft, behavior: 'smooth' })
  }, [activeIndex])

  function handleTagClick(slug: string) {
    setActiveTagState(current => (current === slug ? current : slug))
  }

  return (
    <div className="grid w-full max-w-full gap-3">
      <div className="relative min-w-0">
        <div
          ref={scrollContainerRef}
          className={cn(
            `relative min-w-0 overflow-x-auto overflow-y-hidden px-2 pb-1 lg:w-85 lg:max-w-85`,
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
          <div ref={buttonsWrapperRef} className="relative flex flex-nowrap items-center gap-2">
            {backgroundStyle.isInitialized && (
              <div
                className={`
                  pointer-events-none absolute z-0 rounded-md bg-muted shadow-sm transition-all duration-300 ease-out
                `}
                style={{
                  left: `${backgroundStyle.left}px`,
                  width: `${backgroundStyle.width}px`,
                  height: `${backgroundStyle.height}px`,
                  top: `${backgroundStyle.top}px`,
                }}
              />
            )}

            {tagItems.map((item, index) => (
              <Button
                key={item.slug}
                ref={(el: HTMLButtonElement | null) => {
                  buttonRefs.current[index] = el
                }}
                variant="ghost"
                size="sm"
                className={cn(
                  'relative shrink-0 px-3 whitespace-nowrap transition-none hover:bg-transparent',
                  activeTag === item.slug
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => handleTagClick(item.slug)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading
        ? (
            <div className="grid gap-2">
              {Array.from({ length: 3 }, (_, index) => (
                <EventRelatedSkeleton key={`skeleton-${event.slug}-${activeTag}-${index}`} />
              ))}
            </div>
          )
        : error
          ? (
              <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                {t('Failed to fetch related events.')}
              </div>
            )
          : events.length > 0
            ? (
                <ul className="grid gap-2 lg:w-85">
                  {events.map(relatedEvent => (
                    <li key={relatedEvent.id}>
                      <Link
                        href={`/event/${relatedEvent.slug}`}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/80"
                      >
                        <Image
                          src={relatedEvent.icon_url}
                          alt={relatedEvent.title}
                          width={42}
                          height={42}
                          quality={100}
                          className="shrink-0 rounded-sm object-cover"
                        />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <strong className="line-clamp-2 text-sm font-medium text-foreground">
                            {relatedEvent.title}
                          </strong>
                          <span className={`
                            min-w-13 text-right text-xl leading-none font-semibold text-foreground tabular-nums
                          `}
                          >
                            {Number.isFinite(relatedEvent.chance)
                              ? `${Math.round(relatedEvent.chance ?? 0)}%`
                              : t('—')}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            : (
                <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                  {t('No related events for this tag yet.')}
                </div>
              )}
    </div>
  )
}

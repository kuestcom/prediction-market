'use client'

import type { Event } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { BookmarkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBookmarkStatusAction, toggleBookmarkAction } from '@/app/[locale]/(platform)/_actions/bookmark'
import { Button } from '@/components/ui/button'
import { useAppKit } from '@/hooks/useAppKit'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface EventBookmarkProps {
  event: Event
  refreshStatusOnMount?: boolean
}

interface BookmarkOverrideState {
  eventId: Event['id']
  propValue: boolean
  value: boolean
}

interface InfiniteEventsQueryData {
  pageParams: unknown[]
  pages: Event[][]
}

function isInfiniteEventsQueryData(value: unknown): value is InfiniteEventsQueryData {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<InfiniteEventsQueryData>
  return Array.isArray(candidate.pages) && Array.isArray(candidate.pageParams)
}

function isBookmarkedEventsQuery(queryKey: readonly unknown[]) {
  if (queryKey[0] !== 'events') {
    return false
  }

  if (typeof queryKey[2] === 'boolean') {
    return queryKey[2]
  }

  if (typeof queryKey[4] === 'boolean') {
    return queryKey[4]
  }

  return false
}

function getEventsQueryScope(queryKey: readonly unknown[]) {
  if (queryKey[0] !== 'events') {
    return null
  }

  if (typeof queryKey[4] === 'boolean') {
    return typeof queryKey[11] === 'string' ? queryKey[11] : null
  }

  if (typeof queryKey[2] === 'boolean') {
    return typeof queryKey[9] === 'string' ? queryKey[9] : null
  }

  return null
}

function updateEventsQueryData(
  currentData: unknown,
  event: Event,
  nextBookmarkedState: boolean,
  bookmarkedOnly: boolean,
) {
  if (!isInfiniteEventsQueryData(currentData)) {
    return currentData
  }

  let hasChanges = false
  const nextPages = currentData.pages.map((page) => {
    return page.flatMap((entry) => {
      if (entry.id !== event.id) {
        return [entry]
      }

      hasChanges = true

      if (bookmarkedOnly && !nextBookmarkedState) {
        return []
      }

      return [{ ...entry, is_bookmarked: nextBookmarkedState }]
    })
  })

  if (!hasChanges) {
    return currentData
  }

  return {
    ...currentData,
    pages: nextPages,
  }
}

function createBookmarkOverrideState(
  eventId: Event['id'],
  propValue: boolean,
  value: boolean,
): BookmarkOverrideState {
  return {
    eventId,
    propValue,
    value,
  }
}

function useBookmarkState({
  event,
  refreshStatusOnMount,
}: {
  event: Event
  refreshStatusOnMount: boolean
}) {
  const { open } = useAppKit()
  const user = useUser()
  const queryClient = useQueryClient()
  const [bookmarkOverride, setBookmarkOverride] = useState<BookmarkOverrideState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (
    bookmarkOverride
    && (bookmarkOverride.eventId !== event.id || bookmarkOverride.propValue !== event.is_bookmarked)
  ) {
    setBookmarkOverride(null)
  }

  const isBookmarked = bookmarkOverride
    && bookmarkOverride.eventId === event.id
    && bookmarkOverride.propValue === event.is_bookmarked
    ? bookmarkOverride.value
    : event.is_bookmarked

  async function handleBookmark() {
    if (isSubmitting) {
      return
    }

    const previousState = isBookmarked
    setBookmarkOverride(createBookmarkOverrideState(event.id, event.is_bookmarked, !isBookmarked))
    setIsSubmitting(true)

    try {
      const response = await toggleBookmarkAction(event.id)
      if (response.error) {
        setBookmarkOverride(createBookmarkOverrideState(event.id, event.is_bookmarked, previousState))
        if (response.error === 'Unauthenticated.') {
          void open()
        }
        return
      }

      const persistedBookmarkState = response.data?.isBookmarked
      const actingUserId = response.data?.userId ?? user?.id ?? null
      if (typeof persistedBookmarkState !== 'boolean' || !actingUserId) {
        setBookmarkOverride(createBookmarkOverrideState(event.id, event.is_bookmarked, previousState))
        return
      }

      setBookmarkOverride(createBookmarkOverrideState(event.id, event.is_bookmarked, persistedBookmarkState))

      const matchingEventQueries = queryClient.getQueriesData({
        predicate: query => (
          query.queryKey[0] === 'events'
          && getEventsQueryScope(query.queryKey) === actingUserId
        ),
      })

      matchingEventQueries.forEach(([queryKey, currentData]) => {
        queryClient.setQueryData(
          queryKey,
          updateEventsQueryData(
            currentData,
            event,
            persistedBookmarkState,
            isBookmarkedEventsQuery(queryKey),
          ),
        )
      })

      if (persistedBookmarkState) {
        queryClient.removeQueries({
          type: 'inactive',
          predicate: query => (
            isBookmarkedEventsQuery(query.queryKey)
            && getEventsQueryScope(query.queryKey) === actingUserId
          ),
        })
      }
    }
    catch {
      setBookmarkOverride(createBookmarkOverrideState(event.id, event.is_bookmarked, previousState))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  useEffect(function refreshInitialBookmarkStatus() {
    if (!refreshStatusOnMount || !user?.id) {
      return
    }

    let isActive = true

    void (async function fetchInitialBookmarkStatus() {
      const response = await getBookmarkStatusAction(event.id)
      if (!isActive || response.error || typeof response.data !== 'boolean') {
        return
      }
      setBookmarkOverride(createBookmarkOverrideState(event.id, event.is_bookmarked, response.data))
    })()

    return function cancelInitialBookmarkFetch() {
      isActive = false
    }
  }, [event.id, event.is_bookmarked, refreshStatusOnMount, user?.id])

  return { isBookmarked, isSubmitting, handleBookmark }
}

export default function EventBookmark({
  event,
  refreshStatusOnMount = true,
}: EventBookmarkProps) {
  const { isBookmarked, isSubmitting, handleBookmark } = useBookmarkState({
    event,
    refreshStatusOnMount,
  })

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onMouseDown={(mouseEvent) => {
        mouseEvent.preventDefault()
      }}
      onClick={(clickEvent) => {
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
        void handleBookmark()
      }}
      aria-disabled={isSubmitting}
      aria-pressed={isBookmarked}
      title={isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
      className={cn(
        `
          size-auto rounded-sm border border-transparent bg-transparent p-0 text-foreground transition-colors
          hover:bg-muted/80
          focus-visible:ring-1 focus-visible:ring-ring
          md:size-9
        `,
        { 'opacity-50': isSubmitting },
      )}
    >
      <BookmarkIcon className={cn({ 'fill-current text-primary': isBookmarked })} />
    </Button>
  )
}

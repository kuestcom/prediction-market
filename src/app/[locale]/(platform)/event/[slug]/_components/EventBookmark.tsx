'use client'

import type { Event } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { BookmarkIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getBookmarkStatusAction, toggleBookmarkAction } from '@/app/[locale]/(platform)/_actions/bookmark'
import { Button } from '@/components/ui/button'
import { useAppKit } from '@/hooks/useAppKit'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

const headerIconButtonClass = 'size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:size-9'

interface EventBookmarkProps {
  event: Event
  refreshStatusOnMount?: boolean
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
    const nextPage = page.flatMap((entry) => {
      if (entry.id !== event.id) {
        return [entry]
      }

      hasChanges = true

      if (bookmarkedOnly && !nextBookmarkedState) {
        return []
      }

      return [{ ...entry, is_bookmarked: nextBookmarkedState }]
    })

    return nextPage
  })

  if (!hasChanges) {
    return currentData
  }

  return {
    ...currentData,
    pages: nextPages,
  }
}

export default function EventBookmark({
  event,
  refreshStatusOnMount = true,
}: EventBookmarkProps) {
  const { open } = useAppKit()
  const user = useUser()
  const queryClient = useQueryClient()
  const [isBookmarked, setIsBookmarked] = useState(event.is_bookmarked)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleBookmark = useCallback(async () => {
    if (isSubmitting) {
      return
    }

    const previousState = isBookmarked
    setIsBookmarked(!isBookmarked)
    setIsSubmitting(true)

    try {
      const response = await toggleBookmarkAction(event.id)
      if (response.error) {
        setIsBookmarked(previousState)
        if (response.error === 'Unauthenticated.') {
          queueMicrotask(() => open())
        }
        return
      }

      const nextBookmarkedState = !previousState
      const actingUserId = response.data?.userId ?? user?.id ?? null
      if (!actingUserId) {
        return
      }

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
            nextBookmarkedState,
            isBookmarkedEventsQuery(queryKey),
          ),
        )
      })

      if (nextBookmarkedState) {
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
      setIsBookmarked(previousState)
    }
    finally {
      setIsSubmitting(false)
    }
  }, [event, isBookmarked, isSubmitting, open, queryClient, user?.id])

  useEffect(() => {
    setIsBookmarked(event.is_bookmarked)
  }, [event.is_bookmarked])

  useEffect(() => {
    if (!refreshStatusOnMount || !user?.id) {
      return
    }

    let isActive = true

    void (async () => {
      const response = await getBookmarkStatusAction(event.id)
      if (!isActive || response.error || typeof response.data !== 'boolean') {
        return
      }
      setIsBookmarked(response.data)
    })()

    return () => {
      isActive = false
    }
  }, [event.id, refreshStatusOnMount, user?.id])

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
        headerIconButtonClass,
        'size-auto p-0',
        { 'opacity-50': isSubmitting },
      )}
    >
      <BookmarkIcon className={cn({ 'fill-current text-primary': isBookmarked })} />
    </Button>
  )
}

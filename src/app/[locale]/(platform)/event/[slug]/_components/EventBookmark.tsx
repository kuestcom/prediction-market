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
  event: {
    id: string
    is_bookmarked: boolean
  }
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

function updateEventsQueryData(
  currentData: unknown,
  eventId: string,
  nextBookmarkedState: boolean,
  bookmarkedOnly: boolean,
) {
  if (!isInfiniteEventsQueryData(currentData)) {
    return currentData
  }

  let hasChanges = false
  const nextPages = currentData.pages.map((page) => {
    const nextPage = page.flatMap((entry) => {
      if (entry.id !== eventId) {
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
      const matchingEventQueries = queryClient.getQueriesData({
        predicate: query => query.queryKey[0] === 'events',
      })

      matchingEventQueries.forEach(([queryKey, currentData]) => {
        queryClient.setQueryData(
          queryKey,
          updateEventsQueryData(
            currentData,
            event.id,
            nextBookmarkedState,
            isBookmarkedEventsQuery(queryKey),
          ),
        )
      })
    }
    catch {
      setIsBookmarked(previousState)
    }
    finally {
      setIsSubmitting(false)
    }
  }, [event.id, isBookmarked, isSubmitting, open, queryClient])

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

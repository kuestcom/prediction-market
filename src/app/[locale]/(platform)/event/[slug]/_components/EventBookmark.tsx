'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { useQueryClient } from '@tanstack/react-query'
import { BookmarkIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getBookmarkStatusAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/get-bookmark-status'
import { toggleBookmarkAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/toggle-bookmark'
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
}

export default function EventBookmark({ event }: EventBookmarkProps) {
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const user = useUser()
  const queryClient = useQueryClient()
  const [isBookmarked, setIsBookmarked] = useState(event.is_bookmarked)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleBookmark = useCallback(() => {
    if (isSubmitting) {
      return
    }

    const previousState = isBookmarked
    setIsBookmarked(!isBookmarked)
    setIsSubmitting(true)

    void (async () => {
      try {
        const response = await toggleBookmarkAction(event.id)
        if (response.error) {
          setIsBookmarked(previousState)
          return
        }

        // Keep global event lists stale without forcing immediate refetch in-page.
        void queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'none' })
      }
      catch {
        setIsBookmarked(previousState)
      }
      finally {
        setIsSubmitting(false)
      }
    })
  }, [event.id, isBookmarked, isSubmitting, queryClient])

  useEffect(() => {
    setIsBookmarked(event.is_bookmarked)
  }, [event.is_bookmarked])

  useEffect(() => {
    if (!user?.id) {
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
  }, [event.id, user?.id])

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={() => {
        if (isConnected) {
          handleBookmark()
        }
        else {
          queueMicrotask(() => open())
        }
      }}
      disabled={isSubmitting}
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

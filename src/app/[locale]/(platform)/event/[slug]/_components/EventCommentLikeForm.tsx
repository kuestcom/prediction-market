'use client'

import { HeartIcon } from 'lucide-react'

import type { Comment, User } from '@/types'

import { Toggle } from '@/components/ui/toggle'
import { useAppKit } from '@/hooks/useAppKit'
import { cn } from '@/lib/utils'

interface EventCommentLikeFormProps {
  comment: Comment
  user: User | null
  onLikeToggled: () => void
  isSubmitting?: boolean
}

export default function EventCommentLikeForm({
  comment,
  user,
  onLikeToggled,
  isSubmitting = false,
}: EventCommentLikeFormProps) {
  const { open } = useAppKit()
  const likesCount = comment.likes_count ?? 0

  function handleClick() {
    if (isSubmitting) {
      return
    }
    if (!user) {
      void open()
      return
    }
    onLikeToggled()
  }

  return (
    <Toggle
      type="button"
      size="icon"
      variant="ghost"
      onClick={handleClick}
      disabled={isSubmitting}
      pressed={comment.user_has_liked}
      title={comment.user_has_liked ? 'Remove like' : 'Like'}
      className={cn(
        `flex size-auto items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground data-pressed:text-muted-foreground`,
      )}
    >
      <HeartIcon
        className={cn(
          {
            'fill-current text-destructive': comment.user_has_liked,
          },
          'size-4',
        )}
      />
      <span>{likesCount}</span>
    </Toggle>
  )
}

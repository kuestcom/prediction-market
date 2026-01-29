'use client'

import type { Comment, User } from '@/types'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppKit } from '@/hooks/useAppKit'

interface EventCommentFormProps {
  user: User | null
  onCommentAddedAction: (comment: Comment) => void
  createComment: (content: string) => Promise<Comment>
  isCreatingComment: boolean
}

export default function EventCommentForm({
  user,
  onCommentAddedAction,
  createComment,
  isCreatingComment,
}: EventCommentFormProps) {
  const t = useExtracted()
  const { open } = useAppKit()
  const [content, setContent] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (isCreatingComment) {
      return
    }

    if (!user) {
      queueMicrotask(() => open())
      return
    }

    const trimmed = content.trim()
    if (!trimmed) {
      toast.error(t('Comment content is required'))
      return
    }
    if (trimmed.length > 2000) {
      toast.error(t('Comment is too long (max 2000 characters).'))
      return
    }

    try {
      const comment = await createComment(trimmed)
      setContent('')
      onCommentAddedAction(comment)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('Failed to create comment.')
      toast.error(message)
    }
  }

  return (
    <div className="mt-4 grid gap-2">
      <form
        className="relative"
        onSubmit={handleSubmit}
      >
        <Input
          name="content"
          className={`
            h-11 pr-16
            focus:border-primary focus:ring-primary/20
            focus-visible:border-primary focus-visible:ring-primary/20
          `}
          placeholder={t('Add a comment')}
          required
          value={content}
          onChange={e => setContent(e.target.value)}
        />

        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className={`
            absolute top-1/2 right-2 -translate-y-1/2 bg-transparent text-xs font-medium text-primary
            hover:bg-accent/70 hover:text-primary
          `}
          disabled={isCreatingComment || !content.trim()}
        >
          {isCreatingComment ? t('Posting...') : user ? t('Post') : t('Connect to Post')}
        </Button>
      </form>
    </div>
  )
}

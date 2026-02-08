'use client'

import type { Comment, User } from '@/types'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'

interface EventCommentReplyFormProps {
  user: User | null
  parentCommentId: string
  placeholder: string
  initialValue?: string
  onCancel: () => void
  onReplyAddedAction?: () => void
  createReply: (parentCommentId: string, content: string) => Promise<Comment>
  isCreatingComment: boolean
}

export default function EventCommentReplyForm({
  user,
  parentCommentId,
  placeholder,
  initialValue,
  onReplyAddedAction,
  createReply,
  isCreatingComment,
}: EventCommentReplyFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState(initialValue || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !user) {
      if (!content.trim()) {
        toast.error('Reply content is required')
      }
      return
    }

    try {
      await createReply(parentCommentId, content.trim())
      setContent('')
      onReplyAddedAction?.()
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create reply.'
      toast.error(message)
    }
  }

  if (!user) {
    return <></>
  }

  const avatarUrl = user.image?.trim() ?? ''
  const avatarSeed = user.proxy_wallet_address || user.address || user.username || 'user'
  const showPlaceholder = shouldUseAvatarPlaceholder(avatarUrl)
  const placeholderStyle = showPlaceholder
    ? getAvatarPlaceholderStyle(avatarSeed)
    : undefined

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      {showPlaceholder
        ? (
            <div
              aria-hidden="true"
              className="size-8 shrink-0 rounded-full"
              style={placeholderStyle}
            />
          )
        : (
            <Image
              src={avatarUrl}
              alt={user.username!}
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full object-cover"
            />
          )}
      <div className="flex-1 space-y-2">
        <div className="relative">
          <Input
            ref={inputRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            className={`
              h-11 pr-16 text-sm
              placeholder:text-muted-foreground/70
              focus:border-primary focus:ring-primary/20
              focus-visible:border-primary focus-visible:ring-primary/20
            `}
            placeholder={placeholder}
            required
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1">
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="bg-transparent text-xs font-medium text-primary hover:bg-accent/70 hover:text-primary"
              disabled={isCreatingComment || !content.trim()}
            >
              {isCreatingComment ? 'Posting...' : user ? 'Reply' : 'Connect to Reply'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}

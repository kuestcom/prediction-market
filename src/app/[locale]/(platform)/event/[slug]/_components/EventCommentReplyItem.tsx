import type { Comment, Market } from '@/types'
import { MoreHorizontalIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback } from 'react'
import { resolveCommentUserIdentity } from '@/app/[locale]/(platform)/event/[slug]/_components/comment-user'
import EventCommentContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventCommentContent'
import { CommentPositionsIndicator } from '@/app/[locale]/(platform)/event/[slug]/_components/EventCommentPositionsIndicator'
import ProfileLink from '@/components/ProfileLink'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppKit } from '@/hooks/useAppKit'
import { Link } from '@/i18n/navigation'
import EventCommentLikeForm from './EventCommentLikeForm'
import EventCommentMenu from './EventCommentMenu'
import EventCommentReplyForm from './EventCommentReplyForm'

interface ReplyItemProps {
  reply: Comment
  parentDisplayName: string
  parentProfileSlug: string
  commentId: string
  user: any
  isSingleMarket: boolean
  marketsByConditionId: Map<string, Market>
  onLikeToggle: (commentId: string, replyId: string) => void
  onDelete: (commentId: string, replyId: string) => void
  replyingTo: string | null
  onSetReplyingTo: (id: string | null) => void
  replyText: string
  onSetReplyText: (text: string) => void
  createReply: (parentCommentId: string, content: string) => Promise<Comment>
  isCreatingComment: boolean
  isTogglingLikeForComment: (commentId: string) => boolean
}

export default function EventCommentReplyItem({
  reply,
  parentDisplayName,
  parentProfileSlug,
  commentId,
  user,
  isSingleMarket,
  marketsByConditionId,
  onLikeToggle,
  onDelete,
  replyingTo,
  onSetReplyingTo,
  replyText,
  onSetReplyText,
  createReply,
  isCreatingComment,
  isTogglingLikeForComment,
}: ReplyItemProps) {
  const { open } = useAppKit()
  const { displayName, profileSlug } = resolveCommentUserIdentity(reply)
  const parentHref = parentProfileSlug ? (`/@${parentProfileSlug}` as any) : ('#' as any)
  const t = useExtracted()

  const handleReplyClick = useCallback(() => {
    if (!user) {
      queueMicrotask(() => open())
      return
    }
    const shouldOpen = replyingTo !== reply.id
    onSetReplyingTo(shouldOpen ? reply.id : null)
    if (shouldOpen) {
      onSetReplyText('')
    }
  }, [user, reply, replyingTo, onSetReplyingTo, onSetReplyText, open])

  const handleLikeToggle = useCallback(() => {
    onLikeToggle(commentId, reply.id)
  }, [commentId, reply.id, onLikeToggle])

  const handleDelete = useCallback(() => {
    onDelete(commentId, reply.id)
  }, [commentId, reply.id, onDelete])

  const handleReplyAdded = useCallback(() => {
    onSetReplyingTo(null)
    onSetReplyText('')
  }, [onSetReplyingTo, onSetReplyText])

  const handleReplyCancel = useCallback(() => {
    onSetReplyingTo(null)
    onSetReplyText('')
  }, [onSetReplyingTo, onSetReplyText])

  return (
    <>
      <ProfileLink
        user={{
          image: reply.user_avatar,
          username: displayName,
          address: reply.user_address,
          proxy_wallet_address: reply.user_proxy_wallet_address ?? null,
        }}
        profileSlug={profileSlug}
        date={reply.created_at}
        joinedAt={reply.user_created_at}
        containerClassName="[&_[data-avatar-wrapper]]:mt-1.5 [&_[data-avatar]]:h-10 [&_[data-avatar]]:w-10"
        usernameClassName="text-sm font-semibold text-foreground hover:underline underline-offset-2"
        usernameAddon={(
          <CommentPositionsIndicator
            positions={reply.positions}
            isSingleMarket={isSingleMarket}
            marketsByConditionId={marketsByConditionId}
          />
        )}
      >
        <div className="flex w-full flex-1 gap-3">
          <div className="flex-1">
            <Link
              href={parentHref}
              className={`
                text-sm font-semibold text-primary underline-offset-2 transition-colors
                hover:text-primary/80 hover:underline
              `}
            >
              @
              {parentDisplayName}
            </Link>
            <EventCommentContent content={reply.content} />
            <div className="mt-2 flex items-center gap-3">
              <EventCommentLikeForm
                comment={reply}
                user={user}
                onLikeToggled={handleLikeToggle}
                isSubmitting={isTogglingLikeForComment(reply.id)}
              />
              <button
                type="button"
                className={`
                  rounded-sm px-1.5 py-0.5 text-sm text-muted-foreground transition-colors
                  hover:bg-accent hover:text-foreground
                `}
                onClick={handleReplyClick}
              >
                {t('Reply')}
              </button>
            </div>
          </div>
          {reply.is_owner && (
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Reply options"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <EventCommentMenu
                  comment={reply}
                  onDelete={handleDelete}
                />
              </DropdownMenu>
            </div>
          )}
        </div>
      </ProfileLink>

      {replyingTo === reply.id && (
        <div className="mt-3">
          <EventCommentReplyForm
            user={user}
            parentCommentId={commentId}
            placeholder={`Reply to ${displayName}`}
            initialValue={replyText}
            onCancel={handleReplyCancel}
            onReplyAddedAction={handleReplyAdded}
            createReply={createReply}
            isCreatingComment={isCreatingComment}
          />
        </div>
      )}
    </>
  )
}

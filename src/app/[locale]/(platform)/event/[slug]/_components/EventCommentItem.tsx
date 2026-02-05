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
import EventCommentLikeForm from './EventCommentLikeForm'
import EventCommentMenu from './EventCommentMenu'
import EventCommentReplyForm from './EventCommentReplyForm'
import EventCommentReplyItem from './EventCommentReplyItem'
import EventCommentsLoadMoreReplies from './EventCommentsLoadMoreReplies'

interface CommentItemProps {
  comment: Comment
  user: any
  isSingleMarket: boolean
  marketsByConditionId: Map<string, Market>
  onLikeToggle: (commentId: string) => void
  onDelete: (commentId: string) => void
  replyingTo: string | null
  onSetReplyingTo: (id: string | null) => void
  replyText: string
  onSetReplyText: (text: string) => void
  expandedComments: Set<string>
  onRepliesLoaded: (commentId: string) => void
  onDeleteReply: (commentId: string, replyId: string) => void
  onUpdateReply: (commentId: string, replyId: string) => void
  createReply: (parentCommentId: string, content: string) => Promise<Comment>
  isCreatingComment: boolean
  isTogglingLikeForComment: (commentId: string) => boolean
  isLoadingRepliesForComment: (commentId: string) => boolean
  loadRepliesError: Error | null
  retryLoadReplies: (commentId: string) => void
}

export default function EventCommentItem({
  comment,
  user,
  isSingleMarket,
  marketsByConditionId,
  onLikeToggle,
  onDelete,
  replyingTo,
  onSetReplyingTo,
  replyText,
  onSetReplyText,
  expandedComments,
  onRepliesLoaded,
  onDeleteReply,
  onUpdateReply,
  createReply,
  isCreatingComment,
  isTogglingLikeForComment,
  isLoadingRepliesForComment,
  loadRepliesError,
  retryLoadReplies,
}: CommentItemProps) {
  const { open } = useAppKit()
  const { displayName, profileSlug } = resolveCommentUserIdentity(comment)
  const t = useExtracted()

  const handleReplyClick = useCallback(() => {
    if (!user) {
      queueMicrotask(() => open())
      return
    }
    const shouldOpen = replyingTo !== comment.id
    onSetReplyingTo(shouldOpen ? comment.id : null)
    if (shouldOpen) {
      onSetReplyText('')
    }
  }, [user, comment, replyingTo, onSetReplyingTo, onSetReplyText, open])

  const handleLikeToggle = useCallback(() => {
    onLikeToggle(comment.id)
  }, [comment.id, onLikeToggle])

  const handleDelete = useCallback(() => {
    onDelete(comment.id)
  }, [comment.id, onDelete])

  const handleReplyAdded = useCallback(() => {
    onSetReplyingTo(null)
    onSetReplyText('')
  }, [onSetReplyingTo, onSetReplyText])

  const handleReplyCancel = useCallback(() => {
    onSetReplyingTo(null)
    onSetReplyText('')
  }, [onSetReplyingTo, onSetReplyText])

  return (
    <div className="comment-item">
      <ProfileLink
        user={{
          image: comment.user_avatar,
          username: displayName,
          address: comment.user_address,
          proxy_wallet_address: comment.user_proxy_wallet_address ?? null,
        }}
        profileSlug={profileSlug}
        date={comment.created_at}
        joinedAt={comment.user_created_at}
        containerClassName="[&_[data-avatar-wrapper]]:mt-2.5 [&_[data-avatar]]:h-10 [&_[data-avatar]]:w-10"
        usernameClassName="text-sm font-semibold text-foreground hover:underline underline-offset-2"
        usernameAddon={(
          <CommentPositionsIndicator
            positions={comment.positions}
            isSingleMarket={isSingleMarket}
            marketsByConditionId={marketsByConditionId}
          />
        )}
      >
        <div className="flex w-full flex-1 gap-3">
          <div className="flex-1">
            <EventCommentContent content={comment.content} />
            <div className="mt-2 flex items-center gap-3">
              <EventCommentLikeForm
                comment={comment}
                user={user}
                onLikeToggled={handleLikeToggle}
                isSubmitting={isTogglingLikeForComment(comment.id)}
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
          {comment.is_owner && (
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Comment options"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <EventCommentMenu
                  comment={comment}
                  onDelete={handleDelete}
                />
              </DropdownMenu>
            </div>
          )}
        </div>
      </ProfileLink>

      {replyingTo === comment.id && (
        <div className="ml-13">
          <EventCommentReplyForm
            user={user}
            parentCommentId={comment.id}
            placeholder={`Reply to ${displayName}`}
            initialValue={replyText}
            onCancel={handleReplyCancel}
            onReplyAddedAction={handleReplyAdded}
            createReply={createReply}
            isCreatingComment={isCreatingComment}
          />
        </div>
      )}

      {comment.recent_replies && comment.recent_replies.length > 0 && (
        <div className="ml-13">
          {comment.recent_replies.map(reply => (
            <EventCommentReplyItem
              key={reply.id}
              reply={reply}
              parentDisplayName={displayName}
              parentProfileSlug={profileSlug}
              commentId={comment.id}
              user={user}
              isSingleMarket={isSingleMarket}
              marketsByConditionId={marketsByConditionId}
              onLikeToggle={onUpdateReply}
              onDelete={onDeleteReply}
              replyingTo={replyingTo}
              onSetReplyingTo={onSetReplyingTo}
              replyText={replyText}
              onSetReplyText={onSetReplyText}
              createReply={createReply}
              isCreatingComment={isCreatingComment}
              isTogglingLikeForComment={isTogglingLikeForComment}
            />
          ))}

          {comment.replies_count > 3 && !expandedComments.has(comment.id) && (
            <EventCommentsLoadMoreReplies
              comment={comment}
              onRepliesLoaded={onRepliesLoaded}
              isLoading={isLoadingRepliesForComment(comment.id)}
              error={loadRepliesError}
              onRetry={() => retryLoadReplies(comment.id)}
            />
          )}
        </div>
      )}
    </div>
  )
}

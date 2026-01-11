import type { Comment } from '@/types'
import { MoreHorizontalIcon } from 'lucide-react'
import { useCallback } from 'react'
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
  eventId: string
  user: any
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
  createReply: (eventId: string, parentCommentId: string, content: string, user?: any) => void
  isCreatingComment: boolean
  isLoadingRepliesForComment: (commentId: string) => boolean
  loadRepliesError: Error | null
  retryLoadReplies: (commentId: string) => void
}

export default function EventCommentItem({
  comment,
  eventId,
  user,
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
  isLoadingRepliesForComment,
  loadRepliesError,
  retryLoadReplies,
}: CommentItemProps) {
  const { open } = useAppKit()

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
    <div className="grid gap-3">
      <ProfileLink
        user={{
          image: comment.user_avatar,
          username: comment.username,
          address: comment.user_address,
          proxy_wallet_address: comment.user_proxy_wallet_address ?? null,
        }}
        date={comment.created_at}
        joinedAt={comment.user_created_at}
        tooltipVariant="activity"
      >
        <div className="flex w-full flex-1 gap-3">
          <div className="flex-1">
            <p className="text-sm">{comment.content}</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={handleReplyClick}
              >
                Reply
              </button>
              <EventCommentLikeForm
                comment={comment}
                user={user}
                onLikeToggled={handleLikeToggle}
              />
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
                  eventId={eventId}
                  onDelete={handleDelete}
                />
              </DropdownMenu>
            </div>
          )}
        </div>
      </ProfileLink>

      {replyingTo === comment.id && (
        <div className="mt-3 ml-11">
          <EventCommentReplyForm
            user={user}
            eventId={eventId}
            parentCommentId={comment.id}
            placeholder={`Reply to ${comment.username}`}
            initialValue={replyText}
            onCancel={handleReplyCancel}
            onReplyAddedAction={handleReplyAdded}
            createReply={createReply}
            isCreatingComment={isCreatingComment}
          />
        </div>
      )}

      {comment.recent_replies && comment.recent_replies.length > 0 && (
        <div className="ml-11 flex flex-col gap-3">
          {comment.recent_replies.map(reply => (
            <EventCommentReplyItem
              key={reply.id}
              reply={reply}
              parentUsername={comment.username}
              commentId={comment.id}
              eventId={eventId}
              user={user}
              onLikeToggle={onUpdateReply}
              onDelete={onDeleteReply}
              replyingTo={replyingTo}
              onSetReplyingTo={onSetReplyingTo}
              replyText={replyText}
              onSetReplyText={onSetReplyText}
              createReply={createReply}
              isCreatingComment={isCreatingComment}

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

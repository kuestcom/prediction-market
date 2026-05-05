import type { Comment } from '@/types'
import { AlertCircleIcon, LoaderIcon } from 'lucide-react'

interface EventCommentsLoadMoreRepliesProps {
  comment: Comment
  onRepliesLoaded: (commentId: string) => void
  isLoading: boolean
  error: Error | null
  onRetry: () => void
}

export default function EventCommentsLoadMoreReplies({
  comment,
  onRepliesLoaded,
  isLoading,
  error,
  onRetry,
}: EventCommentsLoadMoreRepliesProps) {
  function handleLoadMoreReplies() {
    onRepliesLoaded(comment.id)
  }

  if (comment.replies_count <= 3) {
    return null
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <AlertCircleIcon className="size-3 text-destructive" />
        <span className="text-muted-foreground">Failed to load replies</span>
        <button
          type="button"
          className="text-primary transition-colors hover:text-primary/80"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`
        flex items-center gap-2 text-left text-xs text-muted-foreground transition-colors
        hover:text-foreground
        disabled:cursor-not-allowed disabled:opacity-50
      `}
      onClick={handleLoadMoreReplies}
      disabled={isLoading}
    >
      {isLoading && <LoaderIcon className="size-3 animate-spin" />}
      <span>
        {isLoading ? 'Loading replies...' : `View ${comment.replies_count - 3} more replies`}
      </span>
    </button>
  )
}

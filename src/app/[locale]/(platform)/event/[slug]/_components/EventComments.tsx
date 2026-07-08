'use client'

import type { Comment, Event, User } from '@/types'
import { ShieldIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useInfiniteComments } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useInfiniteComments'
import { countDirectReplies } from '@/app/[locale]/(platform)/event/[slug]/_utils/comment-replies'
import AlertBanner from '@/components/AlertBanner'
import ProfileLinkSkeleton from '@/components/ProfileLinkSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import EventCommentForm from './EventCommentForm'
import EventCommentItem from './EventCommentItem'

interface EventCommentsProps {
  event: Event
  user: User | null
}

interface InfiniteScrollErrorState {
  contextKey: string
  message: string
}

function useMarketsByConditionId(markets: Event['markets']) {
  return useMemo(() => {
    const map = new Map<string, Event['markets'][number]>()
    markets.forEach((market) => {
      if (market?.condition_id) {
        map.set(market.condition_id, market)
      }
    })
    return map
  }, [markets])
}

function useExpandedCommentIds(comments: Comment[]) {
  return useMemo(() => {
    return new Set(
      comments
        .filter(comment => countDirectReplies(comment) > 3)
        .map(comment => comment.id),
    )
  }, [comments])
}

function useCommentActionHandlers({
  loadMoreReplies,
  toggleCommentLike,
  deleteReply,
  toggleReplyLike,
  deleteComment,
  refetch,
  setInfiniteScrollError,
  setSortBy,
  setHoldersOnly,
}: {
  loadMoreReplies: (commentId: string) => void
  toggleCommentLike: (commentId: string) => void
  deleteReply: (commentId: string, replyId: string) => void
  toggleReplyLike: (replyId: string) => void
  deleteComment: (commentId: string) => void
  refetch: () => Promise<unknown>
  setInfiniteScrollError: (value: InfiniteScrollErrorState | null) => void
  setSortBy: (value: 'newest' | 'most_liked') => void
  setHoldersOnly: (value: boolean) => void
}) {
  const handleRepliesLoaded = useCallback((commentId: string) => {
    loadMoreReplies(commentId)
  }, [loadMoreReplies])

  const handleLikeToggled = useCallback((commentId: string) => {
    toggleCommentLike(commentId)
  }, [toggleCommentLike])

  const handleDeleteReply = useCallback((commentId: string, replyId: string) => {
    deleteReply(commentId, replyId)
  }, [deleteReply])

  const handleUpdateReply = useCallback((_: string, replyId: string) => {
    toggleReplyLike(replyId)
  }, [toggleReplyLike])

  const handleDeleteComment = useCallback((commentId: string) => {
    deleteComment(commentId)
  }, [deleteComment])

  const handleRefetch = useCallback(() => {
    setInfiniteScrollError(null)
    void refetch()
  }, [refetch, setInfiniteScrollError])

  const handleCommentAdded = useCallback(() => {
    setInfiniteScrollError(null)
    void refetch()
  }, [refetch, setInfiniteScrollError])

  const handleSortChange = useCallback((value: string) => {
    setInfiniteScrollError(null)
    setSortBy(value as 'newest' | 'most_liked')
  }, [setInfiniteScrollError, setSortBy])

  const handleHoldersOnlyChange = useCallback((checked: boolean | 'indeterminate') => {
    setInfiniteScrollError(null)
    setHoldersOnly(Boolean(checked))
  }, [setInfiniteScrollError, setHoldersOnly])

  return {
    handleRepliesLoaded,
    handleLikeToggled,
    handleDeleteReply,
    handleUpdateReply,
    handleDeleteComment,
    handleRefetch,
    handleCommentAdded,
    handleSortChange,
    handleHoldersOnlyChange,
  }
}

function useInfiniteCommentsScroll({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isInitialized,
  contextKey,
}: {
  fetchNextPage: () => Promise<unknown>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isInitialized: boolean
  contextKey: string
}) {
  const [infiniteScrollError, setInfiniteScrollError] = useState<InfiniteScrollErrorState | null>(null)
  const visibleInfiniteScrollError = infiniteScrollError?.contextKey === contextKey
    ? infiniteScrollError.message
    : null

  const handleFetchNextPage = useCallback(async function fetchNextCommentsPage() {
    setInfiniteScrollError(null)

    try {
      await fetchNextPage()
    }
    catch (error) {
      setInfiniteScrollError({
        contextKey,
        message: error instanceof Error ? error.message : 'Failed to load more comments',
      })
    }
  }, [fetchNextPage, contextKey])

  useEffect(function loadMoreCommentsOnScrollNearBottom() {
    function handleWindowScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      if (scrollTop + windowHeight >= documentHeight - 1000) {
        if (hasNextPage && !isFetchingNextPage && isInitialized && !visibleInfiniteScrollError) {
          void handleFetchNextPage()
        }
      }
    }

    window.addEventListener('scroll', handleWindowScroll)
    return function detachInfiniteCommentsScrollListener() {
      window.removeEventListener('scroll', handleWindowScroll)
    }
  }, [handleFetchNextPage, hasNextPage, isFetchingNextPage, isInitialized, visibleInfiniteScrollError])

  const retryInfiniteScroll = useCallback(() => {
    void handleFetchNextPage()
  }, [handleFetchNextPage])

  return {
    setInfiniteScrollError,
    visibleInfiniteScrollError,
    retryInfiniteScroll,
  }
}

export default function EventComments({ event, user }: EventCommentsProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'most_liked'>('newest')
  const [holdersOnly, setHoldersOnly] = useState(false)
  const holdersCheckboxId = useId()
  const isSportsEvent = Boolean(event.sports_sport_slug?.trim())
  const marketsByConditionId = useMarketsByConditionId(event.markets)
  const t = useExtracted()

  const {
    comments,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    createComment,
    toggleCommentLike,
    deleteComment,
    toggleReplyLike,
    deleteReply,
    loadMoreReplies,
    createReply,
    isCreatingComment,
    isDeletingCommentForComment,
    isTogglingLikeForComment,
    status,
    isLoadingRepliesForComment,
    loadRepliesError,
    retryLoadReplies,
  } = useInfiniteComments(event.slug, sortBy, user, holdersOnly)
  const isInitialized = status === 'success'
  const infiniteScrollContextKey = `${sortBy}:${holdersOnly}:${comments.length}`

  const {
    setInfiniteScrollError,
    visibleInfiniteScrollError,
    retryInfiniteScroll,
  } = useInfiniteCommentsScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isInitialized,
    contextKey: infiniteScrollContextKey,
  })
  const expandedComments = useExpandedCommentIds(comments)

  const {
    handleRepliesLoaded,
    handleLikeToggled,
    handleDeleteReply,
    handleUpdateReply,
    handleDeleteComment,
    handleRefetch,
    handleCommentAdded,
    handleSortChange,
    handleHoldersOnlyChange,
  } = useCommentActionHandlers({
    loadMoreReplies,
    toggleCommentLike,
    deleteReply,
    toggleReplyLike,
    deleteComment,
    refetch,
    setInfiniteScrollError,
    setSortBy,
    setHoldersOnly,
  })

  if (error) {
    return (
      <div className="mt-2">
        <AlertBanner
          title="Internal server error"
          description={(
            <Button
              type="button"
              onClick={handleRefetch}
              size="sm"
              variant="link"
              className="-ml-3"
            >
              Try again
            </Button>
          )}
        />
      </div>
    )
  }

  return (
    <div id="commentsInner">
      <EventCommentForm
        user={user}
        createComment={createComment}
        isCreatingComment={isCreatingComment}
        onCommentAddedAction={handleCommentAdded}
      />
      <Badge className="mt-2 h-8 w-full md:hidden [&>svg]:size-4" variant="outline">
        <ShieldIcon />
        {t('Beware of external links')}
      </Badge>
      <div className="mt-3 flex items-center gap-3">
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger size="default" className="h-9 px-3 text-sm dark:bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="p-1">
            <SelectItem value="newest" className="my-0.5 cursor-pointer rounded-sm py-1.5 pl-2">
              {t('Newest')}
            </SelectItem>
            <SelectItem value="most_liked" className="my-0.5 cursor-pointer rounded-sm py-1.5 pl-2">
              {t('Most liked')}
            </SelectItem>
          </SelectContent>
        </Select>
        <label
          htmlFor={holdersCheckboxId}
          suppressHydrationWarning
          className="ml-2 inline-flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <Checkbox
            id={holdersCheckboxId}
            checked={holdersOnly}
            onCheckedChange={handleHoldersOnlyChange}
            className="size-5 rounded-sm dark:bg-transparent"
          />
          {t('Holders')}
        </label>
        <Badge className="ml-auto hidden h-8 md:inline-flex [&>svg]:size-4" variant="outline">
          <ShieldIcon />
          {t('Beware of external links')}
        </Badge>
      </div>

      <div className="mt-1">
        {status === 'pending'
          ? (
              <>
                <ProfileLinkSkeleton showDate={true} showChildren={true} />
                <ProfileLinkSkeleton showDate={true} showChildren={true} />
                <ProfileLinkSkeleton showDate={true} showChildren={true} />
              </>
            )
          : comments.length === 0
            ? (
                <div className="text-center text-sm text-muted-foreground">
                  {t('No comments yet. Be the first to comment!')}
                </div>
              )
            : comments.map(comment => (
                <EventCommentItem
                  key={comment.id}
                  comment={comment}
                  user={user}
                  usePrimaryPositionTone={isSportsEvent}
                  isSingleMarket={(event.total_markets_count ?? event.markets.length) <= 1}
                  marketsByConditionId={marketsByConditionId}
                  onLikeToggle={handleLikeToggled}
                  isTogglingLikeForComment={isTogglingLikeForComment}
                  onDelete={handleDeleteComment}
                  replyingTo={replyingTo}
                  onSetReplyingTo={setReplyingTo}
                  replyText={replyText}
                  onSetReplyText={setReplyText}
                  expandedComments={expandedComments}
                  onRepliesLoaded={handleRepliesLoaded}
                  onDeleteReply={handleDeleteReply}
                  onUpdateReply={handleUpdateReply}
                  createReply={createReply}
                  isCreatingComment={isCreatingComment}
                  isDeletingCommentForComment={isDeletingCommentForComment}
                  isLoadingRepliesForComment={isLoadingRepliesForComment}
                  loadRepliesError={loadRepliesError}
                  retryLoadReplies={retryLoadReplies}
                />
              ))}

        {isFetchingNextPage && (
          <div className="mt-4">
            <ProfileLinkSkeleton showDate={true} showChildren={true} />
            <ProfileLinkSkeleton showDate={true} showChildren={true} />
            <ProfileLinkSkeleton showDate={true} showChildren={true} />
          </div>
        )}

        {visibleInfiniteScrollError && (
          <div className="mt-6">
            <AlertBanner
              title="Error loading more comments"
              description={(
                <Button
                  type="button"
                  onClick={retryInfiniteScroll}
                  size="sm"
                  variant="link"
                  className="-ml-3"
                >
                  Try again
                </Button>
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}

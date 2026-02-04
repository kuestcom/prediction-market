'use client'

import type { Event, User } from '@/types'
import { ShieldIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useInfiniteComments } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useInfiniteComments'
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

export default function EventComments({ event, user }: EventCommentsProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(() => new Set())
  const [isInitialized, setIsInitialized] = useState(false)
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'most_liked'>('newest')
  const [holdersOnly, setHoldersOnly] = useState(false)
  const holdersCheckboxId = useId()
  const marketsByConditionId = useMemo(() => {
    const map = new Map<string, Event['markets'][number]>()
    event.markets.forEach((market) => {
      if (market?.condition_id) {
        map.set(market.condition_id, market)
      }
    })
    return map
  }, [event.markets])

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
    isTogglingLikeForComment,
    status,
    isLoadingRepliesForComment,
    loadRepliesError,
    retryLoadReplies,
  } = useInfiniteComments(event.slug, sortBy, user, holdersOnly)

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      if (scrollTop + windowHeight >= documentHeight - 1000) {
        if (hasNextPage && !isFetchingNextPage && isInitialized) {
          fetchNextPage().catch((error) => {
            setInfiniteScrollError(error.message || 'Failed to load more comments')
          })
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isInitialized])

  useEffect(() => {
    if (status === 'success' && !isInitialized) {
      queueMicrotask(() => setIsInitialized(true))
    }
  }, [status, isInitialized])

  useEffect(() => {
    queueMicrotask(() => setInfiniteScrollError(null))
  }, [comments.length])

  const handleRepliesLoaded = useCallback((commentId: string) => {
    loadMoreReplies(commentId)
  }, [loadMoreReplies])

  useEffect(() => {
    comments.forEach((comment) => {
      if (comment.recent_replies && comment.recent_replies.length > 3) {
        setExpandedComments(prev => new Set([...prev, comment.id]))
      }
    })
  }, [comments])

  const handleLikeToggled = useCallback((commentId: string) => {
    toggleCommentLike(commentId)
  }, [toggleCommentLike])

  const handleDeleteReply = useCallback((commentId: string, replyId: string) => {
    deleteReply(commentId, replyId)
  }, [deleteReply])

  const handleUpdateReply = useCallback((commentId: string, replyId: string) => {
    toggleReplyLike(replyId)
  }, [toggleReplyLike])

  const handleDeleteComment = useCallback((commentId: string) => {
    deleteComment(commentId)
  }, [deleteComment])

  const retryInfiniteScroll = useCallback(() => {
    setInfiniteScrollError(null)
    fetchNextPage().catch((error) => {
      setInfiniteScrollError(error.message || 'Failed to load more comments')
    })
  }, [fetchNextPage])

  if (error) {
    return (
      <div className="mt-6">
        <AlertBanner
          title="Internal server error"
          description={(
            <Button
              type="button"
              onClick={() => refetch()}
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
    <>
      <EventCommentForm
        user={user}
        createComment={createComment}
        isCreatingComment={isCreatingComment}
        onCommentAddedAction={() => refetch()}
      />
      <Badge className="h-8 w-full md:hidden [&>svg]:size-4" variant="outline">
        <ShieldIcon />
        {t('Beware of external links')}
      </Badge>
      <div className="mt-2 flex items-center gap-3">
        <Select value={sortBy} onValueChange={value => setSortBy(value as 'newest' | 'most_liked')}>
          <SelectTrigger size="default" className="h-9 px-3 text-sm dark:bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t('Newest')}</SelectItem>
            <SelectItem value="most_liked">{t('Most liked')}</SelectItem>
          </SelectContent>
        </Select>
        <label
          htmlFor={holdersCheckboxId}
          className="ml-2 inline-flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <Checkbox
            id={holdersCheckboxId}
            checked={holdersOnly}
            onCheckedChange={checked => setHoldersOnly(Boolean(checked))}
            className="size-5 rounded-sm dark:bg-transparent"
          />
          {t('Holders')}
        </label>
        <Badge className="ml-auto hidden h-8 md:inline-flex [&>svg]:size-4" variant="outline">
          <ShieldIcon />
          {t('Beware of external links')}
        </Badge>
      </div>

      <div className="mt-6">
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

        {infiniteScrollError && (
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
    </>
  )
}

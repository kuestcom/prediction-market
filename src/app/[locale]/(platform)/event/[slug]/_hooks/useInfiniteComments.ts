import type { Comment, User } from '@/types'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useSignMessage } from 'wagmi'
import { commentMetricsQueryKey } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useCommentMetrics'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import {
  clearCommunityAuth,
  ensureCommunityToken,
  loadCommunityAuth,
  parseCommunityError,
} from '@/lib/community-auth'

const COMMENTS_PAGE_SIZE = 20

type CommentSort = 'newest' | 'most_liked'

function resolveSort(sortBy: CommentSort) {
  return sortBy === 'most_liked' ? 'top' : 'recent'
}

function hasPositivePositions(positions?: Comment['positions']) {
  if (!Array.isArray(positions)) {
    return false
  }

  return positions.some((position) => {
    if (!position) {
      return false
    }
    const amount = typeof position.amount === 'number' ? position.amount : Number(position.amount)
    return Number.isFinite(amount) && amount > 0
  })
}

export function useInfiniteComments(
  eventSlug: string,
  sortBy: CommentSort,
  user: User | null,
  holdersOnly = false,
) {
  const queryClient = useQueryClient()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const [infiniteScrollError, setInfiniteScrollError] = useState<Error | null>(null)
  const [loadingRepliesForComment, setLoadingRepliesForComment] = useState<string | null>(null)
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(() => new Set())
  const commentsQueryKey = ['event-comments', eventSlug, sortBy, holdersOnly, user?.address ?? null]
  const communityApiUrl = process.env.COMMUNITY_URL!

  const getCommunityToken = useCallback(async () => {
    if (!user?.address) {
      throw new Error('Connect your wallet to comment')
    }

    return await ensureCommunityToken({
      address: user.address,
      signMessageAsync: args => runWithSignaturePrompt(() => signMessageAsync(args)),
      communityApiUrl,
      proxyWalletAddress: user.proxy_wallet_address ?? null,
    })
  }, [communityApiUrl, runWithSignaturePrompt, signMessageAsync, user?.address, user?.proxy_wallet_address])

  const fetchCommentsPage = useCallback(async ({ pageParam = 0 }: { pageParam: number }) => {
    const offset = pageParam * COMMENTS_PAGE_SIZE
    const url = new URL(`${communityApiUrl}/comments`)
    url.searchParams.set('event_slug', eventSlug)
    url.searchParams.set('limit', COMMENTS_PAGE_SIZE.toString())
    url.searchParams.set('offset', offset.toString())
    url.searchParams.set('sort', resolveSort(sortBy))
    if (holdersOnly) {
      url.searchParams.set('holders_only', 'true')
    }

    const headers: HeadersInit = {}
    if (user?.address) {
      const auth = loadCommunityAuth(user.address)
      if (auth?.token) {
        headers.Authorization = `Bearer ${auth.token}`
      }
    }

    const response = await fetch(url.toString(), { headers })

    if (response.status === 401) {
      clearCommunityAuth()
    }

    if (!response.ok) {
      throw new Error(await parseCommunityError(response, 'Failed to fetch comments'))
    }

    const payload = await response.json()
    return Array.isArray(payload) ? payload : []
  }, [communityApiUrl, eventSlug, holdersOnly, sortBy, user?.address])

  const {
    data,
    status,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: commentsQueryKey,
    queryFn: ({ pageParam = 0 }) => fetchCommentsPage({ pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < COMMENTS_PAGE_SIZE) {
        return undefined
      }

      return allPages.length
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: 3,
  })

  const comments = useMemo(() => {
    if (!data || !data.pages) {
      return []
    }
    const flattened = data.pages.flat()
    if (!holdersOnly) {
      return flattened
    }
    return flattened.filter(comment => hasPositivePositions(comment.positions))
  }, [data, holdersOnly])

  const fetchNextPageWithErrorHandling = useCallback(async () => {
    try {
      setInfiniteScrollError(null)
      await fetchNextPage()
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load more comments')
      setInfiniteScrollError(error)
    }
  }, [fetchNextPage])

  const hasInfiniteScrollError = infiniteScrollError !== null && data?.pages && data.pages.length > 0

  const createCommentMutation = useMutation({
    mutationFn: async ({ content, parentCommentId }: {
      content: string
      parentCommentId?: string
    }) => {
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        throw new Error('Comment content is required')
      }
      if (trimmedContent.length > 2000) {
        throw new Error('Comment is too long (max 2000 characters).')
      }

      const token = await getCommunityToken()

      const response = await fetch(`${communityApiUrl}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_slug: eventSlug,
          content: trimmedContent,
          parent_comment_id: parentCommentId ?? null,
        }),
      })

      if (response.status === 401) {
        clearCommunityAuth()
      }

      if (!response.ok) {
        throw new Error(await parseCommunityError(response, 'Failed to create comment.'))
      }

      return await response.json() as Comment
    },
    onMutate: async ({ content, parentCommentId }) => {
      if (!user) {
        throw new Error('User is required to post a comment')
      }

      await queryClient.cancelQueries({ queryKey: commentsQueryKey })

      const previousComments = queryClient.getQueryData(commentsQueryKey)

      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        content,
        user_id: user.id,
        username: user.username || 'Anonymous',
        user_avatar: user.image || '',
        user_address: user.address || '0x0000...0000',
        user_proxy_wallet_address: user.proxy_wallet_address || null,
        likes_count: 0,
        replies_count: 0,
        created_at: new Date().toISOString(),
        is_owner: true,
        user_has_liked: false,
        recent_replies: [],
      }

      if (parentCommentId) {
        queryClient.setQueryData(commentsQueryKey, (oldData: any) => {
          if (!oldData) {
            return oldData
          }

          const newPages = oldData.pages.map((page: Comment[]) =>
            page.map((comment: Comment) => {
              if (comment.id === parentCommentId) {
                return {
                  ...comment,
                  recent_replies: [...(comment.recent_replies || []), optimisticComment],
                  replies_count: comment.replies_count + 1,
                }
              }
              return comment
            }),
          )

          return { ...oldData, pages: newPages }
        })
      }
      else {
        queryClient.setQueryData(commentsQueryKey, (oldData: any) => {
          if (!oldData) {
            return { pages: [[optimisticComment]], pageParams: [0] }
          }

          const newPages = [...oldData.pages]
          newPages[0] = [optimisticComment, ...newPages[0]]

          return { ...oldData, pages: newPages }
        })
      }

      return { previousComments, optimisticComment }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentsQueryKey, context.previousComments)
      }
    },
    onSuccess: (newComment, variables, context) => {
      queryClient.invalidateQueries({ queryKey: commentMetricsQueryKey(eventSlug) })
      queryClient.setQueryData(commentsQueryKey, (oldData: any) => {
        if (!oldData) {
          return oldData
        }

        const newPages = oldData.pages.map((page: Comment[]) => {
          if (variables.parentCommentId) {
            return page.map((comment: Comment) => {
              if (comment.id === variables.parentCommentId && comment.recent_replies) {
                const updatedReplies = comment.recent_replies.map(reply =>
                  reply.id === context?.optimisticComment.id ? newComment : reply,
                )
                return {
                  ...comment,
                  recent_replies: updatedReplies,
                }
              }
              return comment
            })
          }
          else {
            return page.map((comment: Comment) =>
              comment.id === context?.optimisticComment.id ? newComment : comment,
            )
          }
        })

        return { ...oldData, pages: newPages }
      })
    },
  })

  const likeCommentMutation = useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const token = await getCommunityToken()

      const response = await fetch(`${communityApiUrl}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'toggle' }),
      })

      if (response.status === 401) {
        clearCommunityAuth()
      }

      if (!response.ok) {
        throw new Error(await parseCommunityError(response, 'Failed to update reaction'))
      }

      return await response.json() as { likes_count: number, user_has_liked: boolean }
    },
    onMutate: async ({ commentId }) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey })
      setPendingLikeIds((prev) => {
        const next = new Set(prev)
        next.add(commentId)
        return next
      })
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey })
      if (!variables?.commentId) {
        return
      }
      setPendingLikeIds((prev) => {
        const next = new Set(prev)
        next.delete(variables.commentId)
        return next
      })
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const token = await getCommunityToken()

      const response = await fetch(`${communityApiUrl}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        clearCommunityAuth()
      }

      if (!response.ok) {
        throw new Error(await parseCommunityError(response, 'Failed to delete comment'))
      }

      return commentId
    },
    onMutate: async ({ commentId }) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey })

      const previousComments = queryClient.getQueryData(commentsQueryKey)

      queryClient.setQueryData(commentsQueryKey, (oldData: any) => {
        if (!oldData) {
          return oldData
        }

        const newPages = oldData.pages.map((page: Comment[]) => {
          const filteredPage = page.filter((comment: Comment) => comment.id !== commentId)

          return filteredPage.map((comment: Comment) => {
            if (comment.recent_replies) {
              const originalReplyCount = comment.recent_replies.length
              const filteredReplies = comment.recent_replies.filter(reply => reply.id !== commentId)
              const removedReplies = originalReplyCount - filteredReplies.length

              return {
                ...comment,
                recent_replies: filteredReplies,
                replies_count: Math.max(0, comment.replies_count - removedReplies),
              }
            }
            return comment
          })
        })

        return { ...oldData, pages: newPages }
      })

      return { previousComments }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentsQueryKey, context.previousComments)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentMetricsQueryKey(eventSlug) })
    },
  })

  const createComment = useCallback(async (content: string, parentCommentId?: string) => {
    return await createCommentMutation.mutateAsync({ content, parentCommentId })
  }, [createCommentMutation])

  const toggleCommentLike = useCallback((commentId: string) => {
    likeCommentMutation.mutate({ commentId })
  }, [likeCommentMutation])

  const deleteComment = useCallback((commentId: string) => {
    deleteCommentMutation.mutate({ commentId })
  }, [deleteCommentMutation])

  const createReply = useCallback(async (parentCommentId: string, content: string) => {
    return await createCommentMutation.mutateAsync({ content, parentCommentId })
  }, [createCommentMutation])

  const toggleReplyLike = useCallback((replyId: string) => {
    likeCommentMutation.mutate({ commentId: replyId })
  }, [likeCommentMutation])

  const deleteReply = useCallback((_commentId: string, replyId: string) => {
    deleteCommentMutation.mutate({ commentId: replyId })
  }, [deleteCommentMutation])

  const loadMoreRepliesMutation = useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const headers: HeadersInit = {}
      if (user?.address) {
        const auth = loadCommunityAuth(user.address)
        if (auth?.token) {
          headers.Authorization = `Bearer ${auth.token}`
        }
      }

      const response = await fetch(`${communityApiUrl}/comments/${commentId}/replies`, { headers })
      if (response.status === 401) {
        clearCommunityAuth()
      }
      if (!response.ok) {
        throw new Error(await parseCommunityError(response, 'Failed to load replies'))
      }
      return await response.json()
    },
    onMutate: ({ commentId }) => {
      setLoadingRepliesForComment(commentId)
    },
    onSuccess: (replies, variables) => {
      setLoadingRepliesForComment(null)
      queryClient.setQueryData(commentsQueryKey, (oldData: any) => {
        if (!oldData) {
          return oldData
        }

        const newPages = oldData.pages.map((page: Comment[]) =>
          page.map((comment: Comment) => {
            if (comment.id === variables.commentId) {
              return {
                ...comment,
                recent_replies: replies,
              }
            }
            return comment
          }),
        )

        return { ...oldData, pages: newPages }
      })
    },
    onError: () => {
      setLoadingRepliesForComment(null)
    },
  })

  const loadMoreReplies = useCallback((commentId: string) => {
    loadMoreRepliesMutation.mutate({ commentId })
  }, [loadMoreRepliesMutation])

  const isLoadingRepliesForComment = useCallback((commentId: string) => {
    return loadingRepliesForComment === commentId
  }, [loadingRepliesForComment])

  const isTogglingLikeForComment = useCallback((commentId: string) => {
    return pendingLikeIds.has(commentId)
  }, [pendingLikeIds])

  const retryLoadReplies = useCallback((commentId: string) => {
    loadMoreRepliesMutation.reset()
    loadMoreRepliesMutation.mutate({ commentId })
  }, [loadMoreRepliesMutation])

  return {
    comments,
    status,
    error,
    fetchNextPage: fetchNextPageWithErrorHandling,
    hasNextPage,
    isFetchingNextPage,
    infiniteScrollError,
    hasInfiniteScrollError,
    refetch,

    // Core mutation functions
    createComment,
    toggleCommentLike,
    deleteComment,
    createReply,
    toggleReplyLike,
    deleteReply,
    loadMoreReplies,

    // Mutation states for UI feedback
    isCreatingComment: createCommentMutation.isPending,
    isTogglingLike: likeCommentMutation.isPending,
    isTogglingLikeForComment,
    isDeletingComment: deleteCommentMutation.isPending,
    isLoadingReplies: loadMoreRepliesMutation.isPending,
    isLoadingRepliesForComment,

    // Error states
    createCommentError: createCommentMutation.error,
    likeCommentError: likeCommentMutation.error,
    deleteCommentError: deleteCommentMutation.error,
    loadRepliesError: loadMoreRepliesMutation.error,

    // Reset functions for error handling
    resetCreateCommentError: createCommentMutation.reset,
    resetLikeCommentError: likeCommentMutation.reset,
    resetDeleteCommentError: deleteCommentMutation.reset,
    retryLoadReplies,
  }
}

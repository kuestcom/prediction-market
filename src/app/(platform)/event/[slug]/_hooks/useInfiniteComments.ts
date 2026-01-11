import type { Comment } from '@/types'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { deleteCommentAction } from '@/app/(platform)/event/[slug]/_actions/delete-comment'
import { likeCommentAction } from '@/app/(platform)/event/[slug]/_actions/like-comment'
import { storeCommentAction } from '@/app/(platform)/event/[slug]/_actions/store-comment'

export async function fetchComments({
  pageParam = 0,
  eventSlug,
  sortBy,
}: {
  pageParam: number
  eventSlug: string
  sortBy: 'newest' | 'most_liked'
}): Promise<Comment[]> {
  const limit = 20
  const offset = pageParam * limit

  const url = new URL(`/api/events/${eventSlug}/comments`, window.location.origin)
  url.searchParams.set('limit', limit.toString())
  url.searchParams.set('offset', offset.toString())
  url.searchParams.set('sortBy', sortBy)

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

export function useInfiniteComments(eventSlug: string, sortBy: 'newest' | 'most_liked') {
  const queryClient = useQueryClient()
  const [infiniteScrollError, setInfiniteScrollError] = useState<Error | null>(null)
  const [loadingRepliesForComment, setLoadingRepliesForComment] = useState<string | null>(null)
  const commentsQueryKey = ['event-comments', eventSlug, sortBy]

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
    queryFn: ({ pageParam = 0 }) => fetchComments({ pageParam, eventSlug, sortBy }),
    getNextPageParam: (lastPage, allPages) => {
      const pageSize = 20
      if (lastPage.length < pageSize) {
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
    return data.pages.flat()
  }, [data])

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
    mutationFn: async ({ eventId, content, parentCommentId }: {
      eventId: string
      content: string
      parentCommentId?: string
      user?: any
    }) => {
      const formData = new FormData()
      formData.append('content', content)
      if (parentCommentId) {
        formData.append('parent_comment_id', parentCommentId)
      }

      const result = await storeCommentAction(eventId, formData)
      if (result.error) {
        throw new Error(result.error)
      }
      return result.comment
    },
    onMutate: async ({ content, parentCommentId, user }) => {
      if (!user) {
        throw new Error('User is required to post a comment')
      }

      const currentUser = user as {
        id: string
        username: string
        image?: string | null
        address?: string
        proxy_wallet_address?: string | null
      }

      await queryClient.cancelQueries({ queryKey: ['event-comments', eventSlug] })

      const previousComments = queryClient.getQueryData(commentsQueryKey)

      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        content,
        user_id: currentUser.id,
        username: currentUser.username,
        user_avatar: currentUser.image as string,
        user_address: currentUser.address || '0x0000...0000',
        user_proxy_wallet_address: currentUser.proxy_wallet_address || null,
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
    mutationFn: async ({ eventId, commentId }: { eventId: string, commentId: string }) => {
      const result = await likeCommentAction(eventId, commentId)
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    onMutate: async ({ commentId }) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey })

      const previousComments = queryClient.getQueryData(commentsQueryKey)

      queryClient.setQueryData(commentsQueryKey, (oldData: any) => {
        if (!oldData) {
          return oldData
        }

        const newPages = oldData.pages.map((page: Comment[]) =>
          page.map((comment: Comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                user_has_liked: !comment.user_has_liked,
                likes_count: comment.user_has_liked
                  ? comment.likes_count - 1
                  : comment.likes_count + 1,
              }
            }

            if (comment.recent_replies) {
              return {
                ...comment,
                recent_replies: comment.recent_replies.map((reply) => {
                  if (reply.id === commentId) {
                    return {
                      ...reply,
                      user_has_liked: !reply.user_has_liked,
                      likes_count: reply.user_has_liked
                        ? reply.likes_count - 1
                        : reply.likes_count + 1,
                    }
                  }
                  return reply
                }),
              }
            }
            return comment
          }),
        )

        return { ...oldData, pages: newPages }
      })

      return { previousComments }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentsQueryKey, context.previousComments)
      }
    },
    onSuccess: (data, variables) => {
      if (data) {
        queryClient.setQueryData(commentsQueryKey, (oldData: any) => {
          if (!oldData) {
            return oldData
          }

          const newPages = oldData.pages.map((page: Comment[]) =>
            page.map((comment: Comment) => {
              if (comment.id === variables.commentId) {
                return {
                  ...comment,
                  user_has_liked: data.user_has_liked,
                  likes_count: data.likes_count,
                }
              }

              if (comment.recent_replies) {
                return {
                  ...comment,
                  recent_replies: comment.recent_replies.map((reply) => {
                    if (reply.id === variables.commentId) {
                      return {
                        ...reply,
                        user_has_liked: data.user_has_liked,
                        likes_count: data.likes_count,
                      }
                    }
                    return reply
                  }),
                }
              }
              return comment
            }),
          )

          return { ...oldData, pages: newPages }
        })
      }
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ eventId, commentId }: { eventId: string, commentId: string }) => {
      const result = await deleteCommentAction(eventId, commentId)
      if (result.error) {
        throw new Error(result.error)
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
  })

  const createComment = useCallback((eventId: string, content: string, parentCommentId?: string) => {
    createCommentMutation.mutate({ eventId, content, parentCommentId })
  }, [createCommentMutation])

  const toggleCommentLike = useCallback((eventId: string, commentId: string) => {
    likeCommentMutation.mutate({ eventId, commentId })
  }, [likeCommentMutation])

  const deleteComment = useCallback((commentId: string, eventId: string) => {
    deleteCommentMutation.mutate({ eventId, commentId })
  }, [deleteCommentMutation])

  const createReply = useCallback((eventId: string, parentCommentId: string, content: string, user?: any) => {
    createCommentMutation.mutate({ eventId, content, parentCommentId, user })
  }, [createCommentMutation])

  const toggleReplyLike = useCallback((eventId: string, replyId: string) => {
    likeCommentMutation.mutate({ eventId, commentId: replyId })
  }, [likeCommentMutation])

  const deleteReply = useCallback((_commentId: string, replyId: string, eventId: string) => {
    deleteCommentMutation.mutate({ eventId, commentId: replyId })
  }, [deleteCommentMutation])

  const loadMoreRepliesMutation = useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const response = await fetch(`/api/comments/${commentId}/replies`)
      if (!response.ok) {
        throw new Error('Failed to load replies')
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

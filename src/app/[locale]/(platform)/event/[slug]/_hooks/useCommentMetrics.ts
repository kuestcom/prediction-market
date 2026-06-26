import { useQuery } from '@tanstack/react-query'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { parseCommunityError } from '@/lib/community-auth'

interface CommentMetricsResponse {
  comments_count: number
}

export function commentMetricsQueryKey(eventSlug: string) {
  return ['comment-metrics', eventSlug]
}

async function fetchCommentMetrics(eventSlug: string, communityApiUrl: string, signal?: AbortSignal) {
  const url = new URL(`${communityApiUrl}/comments/metrics`)
  url.searchParams.set('event_slug', eventSlug)

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) {
    throw new Error(await parseCommunityError(response, 'Failed to load comments count'))
  }

  return await response.json() as CommentMetricsResponse
}

export function useCommentMetrics(eventSlug: string) {
  const { communityUrl } = usePublicRuntimeConfig()

  return useQuery({
    queryKey: commentMetricsQueryKey(eventSlug),
    queryFn: ({ signal }) => fetchCommentMetrics(eventSlug, communityUrl, signal),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
    retry: 2,
  })
}

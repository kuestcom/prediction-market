'use client'

import { useQuery } from '@tanstack/react-query'
import { useExtracted } from 'next-intl'

import { Skeleton } from '@/components/ui/skeleton'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { communityFollowQueryKeys, fetchCommunityFollowStats } from '@/lib/community-follows'

export default function CommunityFollowersCount({ wallet }: { wallet: string | null | undefined }) {
  const t = useExtracted()
  const { communityUrl } = usePublicRuntimeConfig()
  const normalizedWallet = wallet?.trim().toLowerCase() ?? ''
  const statsQuery = useQuery({
    queryKey: communityFollowQueryKeys.stats(communityUrl, normalizedWallet),
    queryFn: ({ signal }) =>
      fetchCommunityFollowStats({
        communityApiUrl: communityUrl,
        wallet: normalizedWallet,
        signal,
      }),
    enabled: Boolean(communityUrl && normalizedWallet),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  })

  if (statsQuery.isPending) {
    return <Skeleton aria-label={t('Loading followers...')} className="h-4 w-24" />
  }
  if (!statsQuery.data) {
    return null
  }

  return (
    <span className="text-sm font-semibold text-foreground tabular-nums">
      {t('{count, plural, one {# follower} other {# followers}}', {
        count: statsQuery.data.followersCount,
      })}
    </span>
  )
}

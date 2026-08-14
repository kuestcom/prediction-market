'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowRightIcon, LoaderCircleIcon, UsersIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import { useSignMessage } from 'wagmi'

import type { CommunityFollowingItem, CommunityFollowStatus } from '@/lib/community-follows'
import type { User } from '@/types'

import CommunityFollowButton from '@/components/CommunityFollowButton'
import ProfileLink from '@/components/ProfileLink'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { clearCommunityAuth, ensureCommunityToken } from '@/lib/community-auth'
import { CommunityFollowRequestError, communityFollowQueryKeys, fetchCommunityFollowing } from '@/lib/community-follows'
import { truncateAddress } from '@/lib/formatters'

const FOLLOWING_PAGE_SIZE = 25

function buildInitialStatus(item: CommunityFollowingItem): CommunityFollowStatus {
  return {
    wallet: item.wallet,
    isFollowing: true,
    followersCount: item.followersCount,
    followingCount: item.followingCount,
    profile: item.profile,
  }
}

export default function ManageFollowedTradersDialog({ user }: { user: User }) {
  const t = useExtracted()
  const [open, setOpen] = useState(false)
  const { communityUrl } = usePublicRuntimeConfig()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const viewerAddress = user.address.trim().toLowerCase()
  const queryKey = communityFollowQueryKeys.following(communityUrl, viewerAddress)

  async function getToken(forceRefresh = false) {
    return await ensureCommunityToken({
      address: viewerAddress,
      depositWalletAddress: user.deposit_wallet_address,
      communityApiUrl: communityUrl,
      forceRefresh,
      signMessageAsync: (args) => runWithSignaturePrompt(() => signMessageAsync(args)),
    })
  }

  const followingQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam, signal }) => {
      let token = await getToken()
      try {
        return await fetchCommunityFollowing({
          communityApiUrl: communityUrl,
          token,
          cursor: pageParam,
          limit: FOLLOWING_PAGE_SIZE,
          signal,
        })
      } catch (error) {
        if (!(error instanceof CommunityFollowRequestError) || error.status !== 401) {
          throw error
        }
        clearCommunityAuth()
        token = await getToken(true)
        return await fetchCommunityFollowing({
          communityApiUrl: communityUrl,
          token,
          cursor: pageParam,
          limit: FOLLOWING_PAGE_SIZE,
          signal,
        })
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: open && Boolean(viewerAddress && communityUrl),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
  })

  const followedTraders = useMemo(() => {
    const seen = new Set<string>()
    return (followingQuery.data?.pages ?? []).flatMap((page) =>
      page.data.filter((item) => {
        if (seen.has(item.wallet)) {
          return false
        }
        seen.add(item.wallet)
        return true
      }),
    )
  }, [followingQuery.data?.pages])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        }
      >
        {t('Manage followed traders')}
        <ArrowRightIcon aria-hidden className="size-3.5" />
      </DialogTrigger>

      <DialogContent className="max-h-[min(88dvh,720px)] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <DialogTitle>{t('Manage who you follow.')}</DialogTitle>
          <DialogDescription>{t('Unfollowing a trader also stops their trade alerts.')}</DialogDescription>
        </DialogHeader>

        <div className="min-h-48 overflow-y-auto p-3 sm:p-4">
          {followingQuery.isPending ? (
            <div className="flex min-h-40 items-center justify-center" role="status">
              <LoaderCircleIcon aria-hidden className="size-6 animate-spin text-muted-foreground" />
              <span className="sr-only">{t('Loading followed traders...')}</span>
            </div>
          ) : followingQuery.isError ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">{t('Could not load followed traders.')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void followingQuery.refetch()}>
                {t('Try again')}
              </Button>
            </div>
          ) : followedTraders.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <UsersIcon aria-hidden className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">{t('You are not following any traders yet.')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {followedTraders.map((item) => {
                const profile = item.profile
                const username = profile?.username?.trim() || truncateAddress(item.wallet)
                const initialStatus = buildInitialStatus(item)

                return (
                  <ProfileLink
                    key={item.wallet}
                    user={{
                      address: profile?.walletAddress ?? item.wallet,
                      deposit_wallet_address: profile?.depositWalletAddress ?? item.wallet,
                      image: profile?.avatarUrl ?? '',
                      username,
                    }}
                    profileSlug={profile?.username ?? item.wallet}
                    avatarSize={40}
                    containerClassName="py-3"
                    usernameMaxWidthClassName="max-w-44 sm:max-w-64"
                    trailing={
                      <CommunityFollowButton wallet={item.wallet} variant="manage" initialStatus={initialStatus} />
                    }
                  />
                )
              })}
            </div>
          )}

          {followingQuery.hasNextPage && (
            <div className="flex justify-center border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={followingQuery.isFetchingNextPage}
                onClick={() => void followingQuery.fetchNextPage()}
              >
                {followingQuery.isFetchingNextPage && <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
                {t('Load more')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

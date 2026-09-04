import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import type { User } from '@/types'

import ManageFollowedTradersDialog from '@/components/ManageFollowedTradersDialog'
import * as actualCommunityFollows from '@/lib/community-follows'

import { hoisted } from '../bun-test-helpers'

const WALLET_A = '0x1111111111111111111111111111111111111111'
const WALLET_B = '0x2222222222222222222222222222222222222222'
const mocks = hoisted(() => ({
  ensureCommunityToken: mock(),
  fetchCommunityFollowing: mock(),
}))

void mock.module('next-intl', () => ({ useExtracted: () => (message: string) => message }))
void mock.module('wagmi', () => ({ useSignMessage: () => ({ signMessageAsync: mock() }) }))
void mock.module('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ communityUrl: 'https://community.example' }),
}))
void mock.module('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({ runWithSignaturePrompt: (action: () => unknown) => action() }),
}))
void mock.module('@/lib/community-auth', () => ({
  clearCommunityAuth: mock(),
  ensureCommunityToken: (...args: unknown[]) => mocks.ensureCommunityToken(...args),
}))
void mock.module('@/lib/community-follows', () => {
  return {
    ...actualCommunityFollows,
    fetchCommunityFollowing: (...args: unknown[]) => mocks.fetchCommunityFollowing(...args),
  }
})
void mock.module('@/components/ProfileLink', () => ({
  default: ({ user, trailing }: { user: { username: string }; trailing?: ReactNode }) => (
    <div>
      <span>{user.username}</span>
      {trailing}
    </div>
  ),
}))
void mock.module('@/components/CommunityFollowButton', () => ({
  default: ({ initialStatus, variant }: { initialStatus: { isFollowing: boolean }; variant: string }) => (
    <button type="button">{`${variant}:${initialStatus.isFollowing ? 'Unfollow' : 'Follow'}`}</button>
  ),
}))

const user = {
  id: 'profile-1',
  address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  deposit_wallet_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  settings: { notifications: {} },
} as User

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ManageFollowedTradersDialog user={user} />
    </QueryClientProvider>,
  )
}

describe('ManageFollowedTradersDialog', () => {
  beforeEach(() => {
    mocks.ensureCommunityToken.mockReset().mockResolvedValue('community-token')
    mocks.fetchCommunityFollowing.mockReset()
  })

  it('loads followed traders by cursor with their profile and current Unfollow action', async () => {
    mocks.fetchCommunityFollowing
      .mockResolvedValueOnce({
        data: [
          {
            wallet: WALLET_A,
            followedAt: '2026-08-13T12:00:00Z',
            followersCount: 8,
            followingCount: 2,
            profile: {
              id: 'trader-a',
              username: 'maverick',
              avatarUrl: 'https://cdn.example/maverick.png',
              wallet: WALLET_A,
              walletAddress: null,
              depositWalletAddress: WALLET_A,
            },
          },
        ],
        nextCursor: 'next-page',
      })
      .mockResolvedValueOnce({
        data: [
          {
            wallet: WALLET_B,
            followedAt: '2026-08-12T12:00:00Z',
            followersCount: 4,
            followingCount: 1,
            profile: null,
          },
        ],
        nextCursor: null,
      })

    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Manage followed traders' }))

    expect(screen.getByRole('heading', { name: 'Manage who you follow.' })).toBeInTheDocument()
    expect(screen.getByText('Unfollowing a trader also stops their trade alerts.')).toBeInTheDocument()
    expect(await screen.findByText('maverick')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'manage:Unfollow' })).toBeInTheDocument()
    expect(mocks.fetchCommunityFollowing).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ token: 'community-token', cursor: null, limit: 25 }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('0x22…222222')).toBeInTheDocument()
    expect(mocks.fetchCommunityFollowing).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'next-page' }))
  })
})

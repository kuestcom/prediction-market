import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import type { User } from '@/types'

import ManageFollowedTradersDialog from '@/components/ManageFollowedTradersDialog'

const WALLET_A = '0x1111111111111111111111111111111111111111'
const WALLET_B = '0x2222222222222222222222222222222222222222'
const mocks = vi.hoisted(() => ({
  ensureCommunityToken: vi.fn(),
  fetchCommunityFollowing: vi.fn(),
}))

vi.mock('next-intl', () => ({ useExtracted: () => (message: string) => message }))
vi.mock('wagmi', () => ({ useSignMessage: () => ({ signMessageAsync: vi.fn() }) }))
vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ communityUrl: 'https://community.example' }),
}))
vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({ runWithSignaturePrompt: (action: () => unknown) => action() }),
}))
vi.mock('@/lib/community-auth', () => ({
  clearCommunityAuth: vi.fn(),
  ensureCommunityToken: (...args: unknown[]) => mocks.ensureCommunityToken(...args),
}))
vi.mock('@/lib/community-follows', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/community-follows')>()
  return {
    ...original,
    fetchCommunityFollowing: (...args: unknown[]) => mocks.fetchCommunityFollowing(...args),
  }
})
vi.mock('@/components/ProfileLink', () => ({
  default: ({ user, trailing }: { user: { username: string }; trailing?: ReactNode }) => (
    <div>
      <span>{user.username}</span>
      {trailing}
    </div>
  ),
}))
vi.mock('@/components/CommunityFollowButton', () => ({
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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { CommunityFollowsProvider, useCommunityFollow } from '@/providers/CommunityFollowsProvider'

const WALLET_A = '0x1111111111111111111111111111111111111111'
const WALLET_B = '0x2222222222222222222222222222222222222222'

const mocks = vi.hoisted(() => ({
  ensureCommunityToken: vi.fn(),
  fetchCommunityFollowStatuses: vi.fn(),
  open: vi.fn(),
  setCommunityFollow: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('wagmi', () => ({
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
}))

vi.mock('@/components/ui/toast', () => ({
  toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

vi.mock('@/hooks/useAppKit', () => ({ useAppKit: () => ({ open: mocks.open }) }))
vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ communityUrl: 'https://community.example' }),
}))
vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({ runWithSignaturePrompt: (action: () => unknown) => action() }),
}))
vi.mock('@/stores/useUser', () => ({
  useUser: () => ({
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    deposit_wallet_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  }),
}))
vi.mock('@/lib/community-auth', () => ({
  clearCommunityAuth: vi.fn(),
  ensureCommunityToken: (...args: unknown[]) => mocks.ensureCommunityToken(...args),
  loadCommunityAuth: () => ({ token: 'token-1' }),
}))
vi.mock('@/lib/community-follows', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/community-follows')>()
  return {
    ...original,
    fetchCommunityFollowStatuses: (...args: unknown[]) => mocks.fetchCommunityFollowStatuses(...args),
    setCommunityFollow: (...args: unknown[]) => mocks.setCommunityFollow(...args),
  }
})

function FollowProbe({ wallet }: { wallet: string }) {
  const follow = useCommunityFollow(wallet)
  return (
    <button type="button" onClick={() => void follow.toggleFollow()} disabled={follow.isPending}>
      {wallet === WALLET_A ? 'A' : 'B'}:{follow.isFollowing ? 'following' : 'not-following'}:{follow.followersCount}
    </button>
  )
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommunityFollowsProvider>
        <FollowProbe wallet={WALLET_A} />
        <FollowProbe wallet={WALLET_B} />
      </CommunityFollowsProvider>
    </QueryClientProvider>,
  )
}

describe('CommunityFollowsProvider', () => {
  beforeEach(() => {
    mocks.ensureCommunityToken.mockReset().mockResolvedValue('token-1')
    mocks.fetchCommunityFollowStatuses.mockReset().mockResolvedValue([
      { wallet: WALLET_A, isFollowing: false, followersCount: 2, followingCount: 0, profile: null },
      { wallet: WALLET_B, isFollowing: true, followersCount: 5, followingCount: 0, profile: null },
    ])
    mocks.open.mockReset()
    mocks.setCommunityFollow.mockReset()
    mocks.toastError.mockReset()
  })

  it('batches registered profile wallets into one authenticated status query', async () => {
    renderProvider()

    await screen.findByRole('button', { name: 'A:not-following:2' })
    expect(screen.getByRole('button', { name: 'B:following:5' })).toBeInTheDocument()
    expect(mocks.fetchCommunityFollowStatuses).toHaveBeenCalledTimes(1)
    expect(mocks.fetchCommunityFollowStatuses).toHaveBeenCalledWith(
      expect.objectContaining({ wallets: [WALLET_A, WALLET_B], token: 'token-1' }),
    )
  })

  it('updates optimistically and rolls back when the mutation fails', async () => {
    mocks.setCommunityFollow.mockRejectedValueOnce(new Error('Follow failed'))
    renderProvider()
    const button = await screen.findByRole('button', { name: 'A:not-following:2' })

    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'A:following:3' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'A:not-following:2' })).toBeEnabled())
    expect(mocks.setCommunityFollow).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledWith('Follow failed')
  })
})

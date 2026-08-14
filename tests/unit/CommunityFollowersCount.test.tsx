import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import CommunityFollowersCount from '@/components/CommunityFollowersCount'

const WALLET = '0x1111111111111111111111111111111111111111'
const mocks = vi.hoisted(() => ({ fetchCommunityFollowStats: vi.fn() }))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string, values?: { count?: number }) => {
    if (message.includes('plural')) {
      return `${values?.count} ${values?.count === 1 ? 'follower' : 'followers'}`
    }
    return message
  },
}))

vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ communityUrl: 'https://community.example' }),
}))

vi.mock('@/lib/community-follows', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/community-follows')>()
  return {
    ...original,
    fetchCommunityFollowStats: (...args: unknown[]) => mocks.fetchCommunityFollowStats(...args),
  }
})

function renderCount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommunityFollowersCount wallet={WALLET} />
    </QueryClientProvider>,
  )
}

describe('CommunityFollowersCount', () => {
  beforeEach(() => {
    mocks.fetchCommunityFollowStats.mockReset().mockResolvedValue({ followersCount: 1284, followingCount: 3 })
  })

  it('loads the public follower count for the deposit wallet', async () => {
    renderCount()

    expect(await screen.findByText('1284 followers')).toHaveClass('font-semibold')
    expect(mocks.fetchCommunityFollowStats).toHaveBeenCalledWith(
      expect.objectContaining({ communityApiUrl: 'https://community.example', wallet: WALLET }),
    )
  })
})

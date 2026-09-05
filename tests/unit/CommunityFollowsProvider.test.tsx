import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import * as actualCommunityFollows from '@/lib/community-follows'
import { CommunityFollowsProvider, useCommunityFollow } from '@/providers/CommunityFollowsProvider'

import { hoisted } from '../bun-test-helpers'

const WALLET_A = '0x1111111111111111111111111111111111111111'
const WALLET_B = '0x2222222222222222222222222222222222222222'

const mocks = hoisted(() => ({
  ensureCommunityToken: mock(),
  fetchCommunityFollowStatuses: mock(),
  enableTradeAlerts: mock(),
  open: mock(),
  push: mock(),
  refreshTradeAlerts: mock(),
  setCommunityFollow: mock(),
  toastError: mock(),
  toastDismiss: mock(),
  toastMessage: mock(),
  toastSuccess: mock(),
  tradeAlertState: { enabled: false, permission: 'default' },
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

void mock.module('wagmi', () => ({
  useSignMessage: () => ({ signMessageAsync: mock() }),
}))

void mock.module('@/components/ui/toast', () => ({
  toast: {
    dismiss: (...args: unknown[]) => mocks.toastDismiss(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
    message: (...args: unknown[]) => mocks.toastMessage(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    warning: mock(),
  },
}))

void mock.module('@/hooks/useAppKit', () => ({ useAppKit: () => ({ open: mocks.open }) }))
void mock.module('@/hooks/usePwaInstall', () => ({ usePwaInstall: () => ({ isIos: false, isStandalone: false }) }))
void mock.module('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ communityUrl: 'https://community.example' }),
}))
void mock.module('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({ runWithSignaturePrompt: (action: () => unknown) => action() }),
}))
void mock.module('@/hooks/useTradeAlerts', () => ({
  useTradeAlerts: () => ({
    enable: mocks.enableTradeAlerts,
    refreshState: mocks.refreshTradeAlerts,
  }),
}))
void mock.module('@/i18n/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
void mock.module('@/stores/useTradeAlerts', () => ({
  useTradeAlertsStore: { getState: () => mocks.tradeAlertState },
}))
void mock.module('@/stores/useUser', () => ({
  useUser: () => ({
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    deposit_wallet_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  }),
}))
void mock.module('@/lib/community-auth', () => ({
  clearCommunityAuth: mock(),
  ensureCommunityToken: (...args: unknown[]) => mocks.ensureCommunityToken(...args),
  loadCommunityAuth: () => ({ token: 'token-1' }),
}))
void mock.module('@/lib/community-follows', () => {
  return {
    ...actualCommunityFollows,
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
    mocks.push.mockReset()
    mocks.refreshTradeAlerts.mockReset().mockResolvedValue(undefined)
    mocks.enableTradeAlerts.mockReset().mockResolvedValue(true)
    mocks.setCommunityFollow.mockReset()
    mocks.toastError.mockReset()
    mocks.toastDismiss.mockReset()
    mocks.toastMessage.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.tradeAlertState = { enabled: false, permission: 'default' }
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

  it('offers one-click push activation after a successful follow on this device', async () => {
    mocks.setCommunityFollow.mockResolvedValueOnce({
      wallet: WALLET_A,
      isFollowing: true,
      followersCount: 3,
      followingCount: 0,
      profile: null,
    })
    renderProvider()
    fireEvent.click(await screen.findByRole('button', { name: 'A:not-following:2' }))

    await waitFor(() => expect(mocks.toastMessage).toHaveBeenCalledTimes(1))
    expect(mocks.toastMessage).toHaveBeenCalledWith(
      'Enable push notifications',
      expect.objectContaining({
        description: 'Get trade alerts from people you follow on this device.',
        action: expect.objectContaining({ label: 'Enable' }),
      }),
    )

    const options = mocks.toastMessage.mock.calls[0]?.[1] as { action: { onClick: () => void } }
    options.action.onClick()
    await waitFor(() => expect(mocks.enableTradeAlerts).toHaveBeenCalledTimes(1))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Trade alerts enabled.')
  })

  it('starts push activation before dismissing the follow prompt', async () => {
    let finishEnable: ((enabled: boolean) => void) | undefined
    mocks.enableTradeAlerts.mockReset().mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishEnable = resolve
        }),
    )
    mocks.setCommunityFollow.mockResolvedValueOnce({
      wallet: WALLET_A,
      isFollowing: true,
      followersCount: 3,
      followingCount: 0,
      profile: null,
    })
    renderProvider()
    fireEvent.click(await screen.findByRole('button', { name: 'A:not-following:2' }))

    await waitFor(() => expect(mocks.toastMessage).toHaveBeenCalledTimes(1))
    const options = mocks.toastMessage.mock.calls[0]?.[1] as { action: { onClick: () => void } }
    options.action.onClick()

    expect(mocks.enableTradeAlerts).toHaveBeenCalledOnce()
    expect(mocks.toastDismiss).not.toHaveBeenCalled()

    finishEnable?.(true)
    await waitFor(() => expect(mocks.toastDismiss).toHaveBeenCalledOnce())
    expect(mocks.enableTradeAlerts.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.toastDismiss.mock.invocationCallOrder[0],
    )
  })

  it('does not prompt when push is already enabled in the current browser', async () => {
    mocks.tradeAlertState = { enabled: true, permission: 'granted' }
    mocks.setCommunityFollow.mockResolvedValueOnce({
      wallet: WALLET_A,
      isFollowing: true,
      followersCount: 3,
      followingCount: 0,
      profile: null,
    })
    renderProvider()
    fireEvent.click(await screen.findByRole('button', { name: 'A:not-following:2' }))

    await waitFor(() => expect(mocks.refreshTradeAlerts).toHaveBeenCalledTimes(1))
    expect(mocks.toastMessage).not.toHaveBeenCalled()
  })
})

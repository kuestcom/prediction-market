import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'

import SettingsResolutionWithdrawalDialog from '@/app/[locale]/(platform)/settings/_components/SettingsResolutionWithdrawalDialog'

const mocks = vi.hoisted(() => ({
  onOpenChange: vi.fn(),
  onSubmitted: vi.fn(),
  openAppKit: vi.fn(),
  openTradeRequirements: vi.fn(),
  runWithSignaturePrompt: vi.fn(),
  signAndSubmit: vi.fn(),
  signTypedDataAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => ({ isConnected: true }),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string, values?: Record<string, string>) =>
    Object.entries(values ?? {}).reduce(
      (translated, [key, replacement]) => translated.replaceAll(`{${key}}`, replacement),
      value,
    ),
}))

vi.mock('wagmi', () => ({
  useSignTypedData: () => ({ signTypedDataAsync: mocks.signTypedDataAsync }),
}))

vi.mock('@/app/[locale]/(platform)/_providers/TradingOnboardingProvider', () => ({
  useTradingOnboarding: () => ({ openTradeRequirements: mocks.openTradeRequirements }),
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({ open: mocks.openAppKit }),
}))

vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({ runWithSignaturePrompt: mocks.runWithSignaturePrompt }),
}))

vi.mock('@/lib/wallet/client', () => ({
  signAndSubmitDepositWalletCalls: mocks.signAndSubmit,
}))

vi.mock('@/components/ui/toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => ({
    id: 'user-1',
    address: '0x1111111111111111111111111111111111111111',
    deposit_wallet_address: '0x2222222222222222222222222222222222222222',
    deposit_wallet_status: 'deployed',
  }),
}))

const proposal = {
  id: '7',
  proposalId: '7',
  market: {
    id: `0x${'a'.repeat(64)}`,
    adapter: null,
    questionId: null,
    lockDuration: '172800',
    conditionId: null,
    title: 'Bitcoin Up or Down',
    marketSlug: 'bitcoin-up-or-down',
    icon: '',
    eventSlug: 'bitcoin-up-or-down-event',
    eventTitle: 'Bitcoin Up or Down',
    eventIcon: '',
    eventSeriesSlug: null,
  },
  creator: '0x3333333333333333333333333333333333333333',
  wallet: '0x2222222222222222222222222222222222222222',
  side: 2,
  status: 'active',
  submittedAt: '1785945600',
  withdrawalRequestedAt: null,
  withdrawalAvailableAt: null,
  correct: null,
  rewardEligible: true,
  bondBeneficiary: null,
  bondAmount: '300000000',
  rewardAmount: '4000000',
  transactionHash: `0x${'b'.repeat(64)}`,
  profile: { username: '', avatarUrl: '' },
  history: { correct: '0', incorrect: '0' },
} satisfies DataApiRewardProposal

describe('SettingsResolutionWithdrawalDialog', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.runWithSignaturePrompt.mockImplementation(async (callback: () => Promise<unknown>) => callback())
    mocks.signAndSubmit.mockResolvedValue({ error: null, txHash: `0x${'c'.repeat(64)}` })
  })

  it('explains the 24-hour risk before requesting cancellation', async () => {
    render(
      <SettingsResolutionWithdrawalDialog
        action="request"
        marketTitle="Bitcoin Up or Down"
        onOpenChange={mocks.onOpenChange}
        onSubmitted={mocks.onSubmitted}
        open
        proposal={proposal}
      />,
    )

    expect(screen.getByText('Reward waived')).toBeInTheDocument()
    expect(screen.getByText('Bond at risk')).toBeInTheDocument()
    expect(screen.getByText('Correct: your bond returns, but the reward is waived.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start 24-hour wait' }))

    await waitFor(() => expect(mocks.signAndSubmit).toHaveBeenCalledOnce())
    expect(mocks.signAndSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: 'request_resolution_reward_withdrawal',
        calls: [expect.objectContaining({ data: expect.stringMatching(/^0x9ee679e8/) })],
      }),
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Cancellation requested. Your 24-hour wait has started.')
  })

  it('releases an expired proposal bond to the claimable balance', async () => {
    render(
      <SettingsResolutionWithdrawalDialog
        action="release"
        marketTitle="Bitcoin Up or Down"
        onOpenChange={mocks.onOpenChange}
        onSubmitted={mocks.onSubmitted}
        open
        proposal={{ ...proposal, status: 'withdrawal_pending', withdrawalAvailableAt: '1786032000' }}
      />,
    )

    expect(screen.getByText('The 24-hour wait is complete')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Release $300 bond' }))

    await waitFor(() => expect(mocks.signAndSubmit).toHaveBeenCalledOnce())
    expect(mocks.signAndSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: 'release_resolution_reward_bond',
        calls: [expect.objectContaining({ data: expect.stringMatching(/^0xcc532f2c/) })],
      }),
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Your funds were released. You can claim them now.')
  })
})

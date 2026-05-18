import type { User } from '@/types'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { useUser } from '@/stores/useUser'

const mocks = vi.hoisted(() => ({
  dialogProps: null as any,
  getSession: vi.fn().mockResolvedValue({ data: { user: null } }),
  openAppKit: vi.fn(),
  usePathname: vi.fn(() => '/'),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('next/navigation', () => ({
  usePathname: mocks.usePathname,
}))

vi.mock('wagmi', () => ({
  useSignMessage: () => ({
    signMessageAsync: vi.fn(),
  }),
  useSignTypedData: () => ({
    signTypedDataAsync: vi.fn(),
  }),
}))

vi.mock('@/app/[locale]/(platform)/_actions/approve-tokens', () => ({
  markApprovalStateWithoutTransactionAction: vi.fn(),
}))

vi.mock('@/app/[locale]/(platform)/_actions/deposit-wallet', () => ({
  checkUsernameAvailabilityAction: vi.fn(),
  createDepositWalletAction: vi.fn(),
  enableTradingAuthAction: vi.fn(),
  markAutoRedeemApprovalCompletedAction: vi.fn(),
  updateOnboardingEmailAction: vi.fn(),
  updateOnboardingUsernameAction: vi.fn(),
}))

vi.mock('@/app/[locale]/(platform)/_components/TradingOnboardingDialogs', () => ({
  __esModule: true,
  default: function MockTradingOnboardingDialogs(props: any) {
    mocks.dialogProps = props
    return <div data-testid="active-modal">{props.activeModal ?? ''}</div>
  },
}))

vi.mock('@/hooks/useAffiliateOrderMetadata', () => ({
  useAffiliateOrderMetadata: () => ({
    affiliateAddress: null,
    affiliateSharePercent: null,
    referrerAddress: null,
  }),
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({
    open: mocks.openAppKit,
  }),
}))

vi.mock('@/hooks/useDepositWalletPolling', () => ({
  useDepositWalletPolling: vi.fn(),
}))

vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: (callback: () => Promise<string>) => callback(),
  }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    getSession: mocks.getSession,
  },
}))

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    address: '0x00000000000000000000000000000000000000bb',
    email: '',
    twoFactorEnabled: false,
    username: '',
    image: '',
    settings: {},
    is_admin: false,
    deposit_wallet_address: null,
    deposit_wallet_status: 'not_started',
    ...overrides,
  }
}

describe('TradingOnboardingProvider', () => {
  beforeEach(() => {
    useUser.setState(null)
    mocks.dialogProps = null
    mocks.getSession.mockClear()
    mocks.openAppKit.mockClear()
    mocks.usePathname.mockReturnValue('/')
  })

  afterEach(() => {
    useUser.setState(null)
  })

  it('shows username before email when the current username is generated from the deposit wallet', async () => {
    const depositWalletAddress = '0xbc040c5a56d757986475005f8cde8e41fe3e2486'
    const generatedUsername = `${depositWalletAddress}-1770000000000`

    useUser.setState(createUser({
      deposit_wallet_address: depositWalletAddress,
      deposit_wallet_status: 'deployed',
      email: '',
      settings: {
        onboarding: {
          termsAcceptedAt: '2026-05-18T18:32:43.349Z',
          usernameCompletedAt: '2026-05-18T18:32:43.349Z',
        },
      },
      username: generatedUsername,
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-modal')).toHaveTextContent('username')
    })
    expect(mocks.dialogProps.usernameDefaultValue).toBe('')
  })
})

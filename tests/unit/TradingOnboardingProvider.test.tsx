import type { User } from '@/types'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { useUser } from '@/stores/useUser'

const mocks = vi.hoisted(() => ({
  createDepositWalletAction: vi.fn(),
  dialogProps: null as any,
  enableTradingAuthAction: vi.fn(),
  getSession: vi.fn().mockResolvedValue({ data: { user: null } }),
  markApprovalStateWithoutTransactionAction: vi.fn(),
  openAppKit: vi.fn(),
  signAndSubmitDepositWalletCalls: vi.fn(),
  signTypedDataAsync: vi.fn(),
  usePathname: vi.fn(() => '/'),
}))

const PENDING_DEPOSIT_WALLET_MESSAGE = 'Your trading wallet is still being set up on-chain. Check back shortly.'
const WALLET_RECONNECT_MESSAGE = 'Your wallet connection expired. Reconnect your wallet and try again.'

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
    signTypedDataAsync: mocks.signTypedDataAsync,
  }),
}))

vi.mock('@/app/[locale]/(platform)/_actions/approve-tokens', () => ({
  markApprovalStateWithoutTransactionAction: mocks.markApprovalStateWithoutTransactionAction,
}))

vi.mock('@/app/[locale]/(platform)/_actions/deposit-wallet', () => ({
  checkUsernameAvailabilityAction: vi.fn(),
  createDepositWalletAction: mocks.createDepositWalletAction,
  enableTradingAuthAction: mocks.enableTradingAuthAction,
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

vi.mock('@/lib/wallet/client', () => ({
  signAndSubmitDepositWalletCalls: mocks.signAndSubmitDepositWalletCalls,
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

describe('tradingOnboardingProvider', () => {
  beforeEach(() => {
    useUser.setState(null)
    mocks.createDepositWalletAction.mockReset()
    mocks.dialogProps = null
    mocks.enableTradingAuthAction.mockReset()
    mocks.getSession.mockClear()
    mocks.markApprovalStateWithoutTransactionAction.mockReset()
    mocks.openAppKit.mockClear()
    mocks.signAndSubmitDepositWalletCalls.mockReset()
    mocks.signTypedDataAsync.mockReset()
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

  it('keeps the initial enable trading flow inside the large modal when trading auth is missing', async () => {
    const depositWalletAddress = '0xbc040c5a56d757986475005f8cde8e41fe3e2486'
    mocks.signTypedDataAsync.mockResolvedValue('0xsignature')
    mocks.enableTradingAuthAction.mockResolvedValue({
      error: null,
      data: {
        tradingAuth: {
          relayer: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
          clob: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
        },
      },
    })
    mocks.createDepositWalletAction
      .mockResolvedValueOnce({ error: 'Enable trading to continue.', data: null })
      .mockResolvedValueOnce({
        error: null,
        data: {
          deposit_wallet_address: depositWalletAddress,
          deposit_wallet_signature: null,
          deposit_wallet_signed_at: null,
          deposit_wallet_status: 'deploying',
          deposit_wallet_tx_hash: '0xtx',
        },
      })

    useUser.setState(createUser({
      email: 'user@example.com',
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-modal')).toHaveTextContent('enable')
    })

    await act(async () => {
      await mocks.dialogProps.onCreateDepositWallet()
    })

    expect(mocks.signTypedDataAsync).toHaveBeenCalledTimes(1)
    expect(mocks.enableTradingAuthAction).toHaveBeenCalledTimes(1)
    expect(mocks.createDepositWalletAction).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('active-modal')).toHaveTextContent('enable')
    expect(screen.getByTestId('active-modal')).not.toHaveTextContent('enable-status')
  })

  it('auto-prompts trading auth on event routes', async () => {
    mocks.usePathname.mockReturnValue('/event/test-market')

    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-modal')).toHaveTextContent('enable-status')
    })
  })

  it('opens AppKit instead of exposing wagmi connector errors during enable trading', async () => {
    mocks.createDepositWalletAction.mockResolvedValue({
      error: 'Enable trading to continue.',
      data: null,
    })
    mocks.signTypedDataAsync.mockRejectedValue({
      name: 'ConnectorNotConnectedError',
      message: 'Connector not connected.\n\nVersion:\n@wagmi/core@2.22.1',
    })

    useUser.setState(createUser({
      email: 'user@example.com',
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-modal')).toHaveTextContent('enable')
    })

    await act(async () => {
      await mocks.dialogProps.onCreateDepositWallet()
    })

    await waitFor(() => {
      expect(mocks.dialogProps.enableTradingError).toBe(WALLET_RECONNECT_MESSAGE)
    })
    expect(mocks.openAppKit).toHaveBeenCalledWith({ view: 'Connect' })
    expect(mocks.enableTradingAuthAction).not.toHaveBeenCalled()
  })

  it('does not start token approval signing before the deposit wallet is deployed', async () => {
    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deploying',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          clob: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
          relayer: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await act(async () => {
      await mocks.dialogProps.onApproveTokens()
    })

    await waitFor(() => {
      expect(mocks.dialogProps.tokenApprovalError).toBe(PENDING_DEPOSIT_WALLET_MESSAGE)
    })
    expect(mocks.markApprovalStateWithoutTransactionAction).not.toHaveBeenCalled()
    expect(mocks.signAndSubmitDepositWalletCalls).not.toHaveBeenCalled()
    expect(mocks.signTypedDataAsync).not.toHaveBeenCalled()
  })

  it('does not start auto-redeem signing before the deposit wallet is deployed', async () => {
    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deploying',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
          relayer: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await act(async () => {
      await mocks.dialogProps.onApproveAutoRedeem()
    })

    await waitFor(() => {
      expect(mocks.dialogProps.autoRedeemError).toBe(PENDING_DEPOSIT_WALLET_MESSAGE)
    })
    expect(mocks.signAndSubmitDepositWalletCalls).not.toHaveBeenCalled()
    expect(mocks.signTypedDataAsync).not.toHaveBeenCalled()
  })

  it('resumes deposit wallet polling when auto-redeem approval reports an undeployed wallet', async () => {
    mocks.signAndSubmitDepositWalletCalls.mockResolvedValue({
      code: 'deposit_wallet_not_deployed',
      error: 'Your Deposit Wallet is still being created. Try again in a moment.',
    })

    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
          relayer: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await act(async () => {
      await mocks.dialogProps.onApproveAutoRedeem()
    })

    await waitFor(() => {
      expect(mocks.dialogProps.autoRedeemError).toBe(PENDING_DEPOSIT_WALLET_MESSAGE)
    })
    expect(useUser.getState()?.deposit_wallet_status).toBe('deploying')
    expect(mocks.dialogProps.autoRedeemStep).toBe('idle')
  })

  it('opens AppKit when auto-redeem signing reports a stale wallet connector', async () => {
    mocks.signAndSubmitDepositWalletCalls.mockResolvedValue({
      code: 'wallet_connector_not_connected',
      error: WALLET_RECONNECT_MESSAGE,
    })

    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
          relayer: { enabled: true, updatedAt: '2026-06-06T12:00:00.000Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <div />
      </TradingOnboardingProvider>,
    )

    await act(async () => {
      await mocks.dialogProps.onApproveAutoRedeem()
    })

    await waitFor(() => {
      expect(mocks.dialogProps.autoRedeemError).toBe(WALLET_RECONNECT_MESSAGE)
    })
    expect(mocks.openAppKit).toHaveBeenCalledWith({ view: 'Connect' })
    expect(mocks.dialogProps.autoRedeemStep).toBe('idle')
  })
})

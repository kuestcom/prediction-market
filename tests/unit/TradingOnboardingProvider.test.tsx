import type { User } from '@/types'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
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

function TradingReadyActionProbe({
  forceTradingAuth = true,
  onTradingReady,
}: {
  forceTradingAuth?: boolean
  onTradingReady: () => void
}) {
  const { openTradeRequirements } = useTradingOnboarding()

  return (
    <button
      type="button"
      onClick={() => openTradeRequirements({
        forceTradingAuth,
        onTradingReady,
      })}
    >
      Start pending action
    </button>
  )
}

function EnsureTradingReadyProbe({ onTradingReady }: { onTradingReady: () => void }) {
  const { ensureTradingReady } = useTradingOnboarding()

  return (
    <button
      type="button"
      onClick={() => {
        if (ensureTradingReady()) {
          onTradingReady()
        }
      }}
    >
      Submit trade
    </button>
  )
}

describe('tradingOnboardingProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      enabled: false,
      configured: false,
      effective: false,
      enforcement: 'disabled',
      levelName: '',
      status: 'not_started',
      approvedAt: null,
      updatedAt: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
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
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('places Required Sumsub after profile details and before wallet setup', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      enabled: true,
      configured: true,
      effective: true,
      enforcement: 'required',
      levelName: 'basic-kyc-level',
      status: 'pending',
      approvedAt: null,
      updatedAt: '2026-07-19T12:00:00.000Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    useUser.setState(createUser({ email: 'user@example.com', username: 'user' }))

    render(<TradingOnboardingProvider><div /></TradingOnboardingProvider>)

    await waitFor(() => expect(screen.getByTestId('active-modal')).toHaveTextContent('sumsub'))
    expect(mocks.createDepositWalletAction).not.toHaveBeenCalled()
  })

  it('does not report trading ready before the Sumsub status loads', async () => {
    let resolveStatus: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>((resolve) => {
      resolveStatus = resolve
    }))
    const onTradingReady = vi.fn()
    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <EnsureTradingReadyProbe onTradingReady={onTradingReady} />
      </TradingOnboardingProvider>,
    )
    screen.getByRole('button', { name: 'Submit trade' }).click()
    expect(onTradingReady).not.toHaveBeenCalled()

    await act(async () => {
      resolveStatus?.(new Response(JSON.stringify({
        enabled: true,
        configured: true,
        effective: true,
        enforcement: 'required',
        levelName: 'basic-kyc-level',
        status: 'pending',
        approvedAt: null,
        updatedAt: '2026-07-19T12:00:00.000Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })

    await waitFor(() => expect(screen.getByTestId('active-modal')).toHaveTextContent('sumsub'))
    expect(onTradingReady).not.toHaveBeenCalled()
  })

  it('keeps trading unresolved when the Sumsub status request fails', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 503 }))
    const onTradingReady = vi.fn()
    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <EnsureTradingReadyProbe onTradingReady={onTradingReady} />
      </TradingOnboardingProvider>,
    )
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    act(() => screen.getByRole('button', { name: 'Submit trade' }).click())

    expect(onTradingReady).not.toHaveBeenCalled()
    expect(screen.getByTestId('active-modal')).toBeEmptyDOMElement()
  })

  it.each([
    ['Disabled', false, false, false, 'disabled', ''],
    ['Observe only', true, true, true, 'observe', 'basic-kyc-level'],
  ] as const)('continues trading when a failed status response confirms %s enforcement', async (
    _label,
    enabled,
    configured,
    effective,
    enforcement,
    levelName,
  ) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      enabled,
      configured,
      effective,
      enforcement,
      levelName,
      status: 'error',
      approvedAt: null,
      updatedAt: null,
      error: 'Unable to load verification status.',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    const onTradingReady = vi.fn()
    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <EnsureTradingReadyProbe onTradingReady={onTradingReady} />
      </TradingOnboardingProvider>,
    )
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    act(() => screen.getByRole('button', { name: 'Submit trade' }).click())

    await waitFor(() => expect(onTradingReady).toHaveBeenCalledOnce())
  })

  it('keeps trading blocked when a failed status response confirms Required enforcement', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      enabled: true,
      configured: true,
      effective: true,
      enforcement: 'required',
      levelName: 'basic-kyc-level',
      status: 'error',
      approvedAt: null,
      updatedAt: null,
      error: 'Unable to load verification status.',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    const onTradingReady = vi.fn()
    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <EnsureTradingReadyProbe onTradingReady={onTradingReady} />
      </TradingOnboardingProvider>,
    )
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    act(() => screen.getByRole('button', { name: 'Submit trade' }).click())

    expect(onTradingReady).not.toHaveBeenCalled()
  })

  it('lets Observe only continue after the single Sumsub prompt is dismissed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      enabled: true,
      configured: true,
      effective: true,
      enforcement: 'observe',
      levelName: 'basic-kyc-level',
      status: 'not_started',
      approvedAt: null,
      updatedAt: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    useUser.setState(createUser({ email: 'user@example.com', username: 'user' }))
    render(<TradingOnboardingProvider><div /></TradingOnboardingProvider>)
    await waitFor(() => expect(screen.getByTestId('active-modal')).toHaveTextContent('sumsub'))

    act(() => mocks.dialogProps.onModalOpenChange('sumsub', false))

    await waitFor(() => expect(screen.getByTestId('active-modal')).toHaveTextContent('enable'))
  })

  it('resumes Required onboarding only after server-confirmed approval', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      enabled: true,
      configured: true,
      effective: true,
      enforcement: 'required',
      levelName: 'basic-kyc-level',
      status: 'pending',
      approvedAt: null,
      updatedAt: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    useUser.setState(createUser({ email: 'user@example.com', username: 'user' }))
    render(<TradingOnboardingProvider><div /></TradingOnboardingProvider>)
    await waitFor(() => expect(screen.getByTestId('active-modal')).toHaveTextContent('sumsub'))

    act(() => mocks.dialogProps.onSumsubStatusChange({
      ...mocks.dialogProps.sumsubStatus,
      status: 'approved',
      approvedAt: '2026-07-19T12:00:00.000Z',
    }))

    await waitFor(() => expect(screen.getByTestId('active-modal')).toHaveTextContent('enable'))
  })

  it('keeps polling an in-progress review after the Sumsub dialog closes', async () => {
    let poll: (() => void) | undefined
    let pollRegistrations = 0
    const originalSetInterval = window.setInterval.bind(window)
    vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout, ...args) => {
      if (timeout === 5_000) {
        poll = handler as () => void
        pollRegistrations += 1
        return 1
      }
      return originalSetInterval(handler, timeout, ...args)
    })
    const pendingStatus = {
      enabled: true,
      configured: true,
      effective: true,
      enforcement: 'required',
      levelName: 'basic-kyc-level',
      status: 'pending',
      approvedAt: null,
      updatedAt: '2026-07-19T12:00:00.000Z',
    }
    vi.mocked(fetch).mockImplementation(async () => new Response(
      JSON.stringify(pendingStatus),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    const onTradingReady = vi.fn()
    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <TradingReadyActionProbe forceTradingAuth={false} onTradingReady={onTradingReady} />
      </TradingOnboardingProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('active-modal')).toHaveTextContent('sumsub'))
    act(() => screen.getByRole('button', { name: 'Start pending action' }).click())
    act(() => mocks.dialogProps.onModalOpenChange('sumsub', false))
    await waitFor(() => expect(pollRegistrations).toBeGreaterThanOrEqual(2))

    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({
      ...pendingStatus,
      status: 'approved',
      approvedAt: '2026-07-19T12:05:00.000Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await act(async () => {
      poll?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => expect(mocks.dialogProps.sumsubStatus.status).toBe('approved'))
    await waitFor(() => expect(onTradingReady).toHaveBeenCalledTimes(1))
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

  it('waits for the session refresh before completing trading auth', async () => {
    let resolveSession: ((value: { data: { user: null } }) => void) | undefined
    mocks.getSession.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSession = resolve
    }))
    mocks.signTypedDataAsync.mockResolvedValue('0xsignature')
    mocks.enableTradingAuthAction.mockResolvedValue({
      error: null,
      data: {
        tradingAuth: {
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
    })

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

    let completed = false
    const request = mocks.dialogProps.onEnableTradingAuth().then(() => {
      completed = true
    })

    await waitFor(() => {
      expect(mocks.enableTradingAuthAction).toHaveBeenCalledTimes(1)
      expect(mocks.getSession).toHaveBeenCalledWith({
        query: { disableCookieCache: true },
      })
    })
    expect(completed).toBe(false)

    await act(async () => {
      resolveSession?.({ data: { user: null } })
      await request
    })

    expect(completed).toBe(true)
  })

  it('resumes a pending action after trading becomes ready again', async () => {
    const onTradingReady = vi.fn()
    mocks.signTypedDataAsync.mockResolvedValue('0xsignature')
    mocks.enableTradingAuthAction.mockResolvedValue({
      error: null,
      data: {
        tradingAuth: {
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
    })

    useUser.setState(createUser({
      deposit_wallet_address: '0xbc040c5a56d757986475005f8cde8e41fe3e2486',
      deposit_wallet_status: 'deployed',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          approvals: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z', version: 'v1' },
          clob: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
          relayer: { enabled: true, updatedAt: '2026-07-10T10:41:37.944Z' },
        },
      },
      username: 'user',
    }))

    render(
      <TradingOnboardingProvider>
        <TradingReadyActionProbe onTradingReady={onTradingReady} />
      </TradingOnboardingProvider>,
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Start pending action' }).click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('active-modal')).toHaveTextContent('enable-status')
    })

    await act(async () => {
      await mocks.dialogProps.onEnableTradingAuth()
    })

    await waitFor(() => {
      expect(onTradingReady).toHaveBeenCalledTimes(1)
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

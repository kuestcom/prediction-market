import type { ComponentProps } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradingOnboardingDialogs from '@/app/[locale]/(platform)/_components/TradingOnboardingDialogs'

const mocks = vi.hoisted(() => ({
  useIsMobile: vi.fn(() => false),
}))

const sdkMocks = vi.hoisted(() => ({
  destroy: vi.fn(),
  init: vi.fn(),
  launch: vi.fn(),
  messageHandler: null as ((type: string) => void) | null,
}))

vi.mock('@sumsub/websdk', () => ({
  default: { init: sdkMocks.init },
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/app/[locale]/(platform)/_actions/deposit-wallet', () => ({
  checkUsernameAvailabilityAction: vi.fn(),
}))

vi.mock('@/app/[locale]/(platform)/_components/TradingDialogs', () => ({
  FundAccountDialog: ({ open }: { open: boolean }) => open ? <div data-testid="fund-account-dialog" /> : null,
}))

vi.mock('@/app/[locale]/(platform)/_components/WalletFlow', () => ({
  WalletFlow: () => null,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  },
}))

vi.mock('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => ({ name: 'Kuest' }),
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

type TradingOnboardingDialogsProps = ComponentProps<typeof TradingOnboardingDialogs>

function createProps(
  overrides: Partial<TradingOnboardingDialogsProps> = {},
): TradingOnboardingDialogsProps {
  return {
    activeModal: null,
    onModalOpenChange: vi.fn(),
    usernameDefaultValue: '',
    usernameError: null,
    isUsernameSubmitting: false,
    onUsernameSubmit: vi.fn(),
    emailDefaultValue: '',
    emailError: null,
    isEmailSubmitting: false,
    onEmailSubmit: vi.fn(),
    onEmailSkip: vi.fn(),
    sumsubStatus: {
      enabled: true,
      configured: true,
      effective: true,
      enforcement: 'required',
      levelName: 'basic-kyc-level',
      status: 'not_started',
      approvedAt: null,
      updatedAt: null,
    },
    onSumsubStatusChange: vi.fn(),
    enableTradingStep: 'idle',
    enableTradingError: null,
    onCreateDepositWallet: vi.fn(),
    onEnableTradingAuth: vi.fn(),
    hasDeployedDepositWallet: false,
    hasTradingAuth: false,
    hasTokenApprovals: false,
    approvalsStep: 'idle',
    tokenApprovalError: null,
    onApproveTokens: vi.fn(),
    autoRedeemStep: 'idle',
    autoRedeemError: null,
    onApproveAutoRedeem: vi.fn(),
    fundModalOpen: false,
    onFundOpenChange: vi.fn(),
    onFundDeposit: vi.fn(),
    depositModalOpen: false,
    onDepositOpenChange: vi.fn(),
    withdrawModalOpen: false,
    onWithdrawOpenChange: vi.fn(),
    user: null,
    meldUrl: null,
    ...overrides,
  }
}

describe('tradingOnboardingDialogs', () => {
  beforeEach(() => {
    mocks.useIsMobile.mockReset()
    mocks.useIsMobile.mockReturnValue(false)
    sdkMocks.destroy.mockReset()
    sdkMocks.init.mockReset()
    sdkMocks.launch.mockReset()
    sdkMocks.messageHandler = null

    const sdkBuilder = {
      build: vi.fn(() => ({ destroy: sdkMocks.destroy, launch: sdkMocks.launch })),
      onMessage: vi.fn((handler: (type: string) => void) => {
        sdkMocks.messageHandler = handler
        return sdkBuilder
      }),
      withConf: vi.fn(() => sdkBuilder),
      withOptions: vi.fn(() => sdkBuilder),
    }
    sdkMocks.init.mockReturnValue(sdkBuilder)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['pending', 'Verification is under review'],
    ['on_hold', 'Verification is on hold'],
    ['approved', 'Identity verified'],
    ['rejected', 'Verification rejected'],
    ['error', 'Verification status is temporarily unavailable'],
  ] as const)('renders the accessible Sumsub %s state', (status, label) => {
    render(
      <TradingOnboardingDialogs {...createProps({
        activeModal: 'sumsub',
        sumsubStatus: { ...createProps().sumsubStatus, status },
      })}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('explains that Observe only is optional and allows dismissal', async () => {
    const user = userEvent.setup()
    const onModalOpenChange = vi.fn()
    render(
      <TradingOnboardingDialogs {...createProps({
        activeModal: 'sumsub',
        onModalOpenChange,
        sumsubStatus: {
          ...createProps().sumsubStatus,
          enforcement: 'observe',
        },
      })}
      />,
    )

    expect(screen.getByText('Verification is optional and will not block your account in Observe only mode.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onModalOpenChange).toHaveBeenCalledWith('sumsub', false)
  })

  it('uses the latest verification state when the SDK reports submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ token: 'access-token' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    const initialStatus = createProps().sumsubStatus
    const view = render(
      <TradingOnboardingDialogs {...createProps({
        activeModal: 'sumsub',
        onSumsubStatusChange: onStatusChange,
        sumsubStatus: initialStatus,
      })}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Start verification' }))
    await waitFor(() => expect(sdkMocks.messageHandler).toBeTypeOf('function'))

    view.rerender(
      <TradingOnboardingDialogs {...createProps({
        activeModal: 'sumsub',
        onSumsubStatusChange: onStatusChange,
        sumsubStatus: { ...initialStatus, levelName: 'enhanced-kyc-level' },
      })}
      />,
    )
    act(() => sdkMocks.messageHandler?.('idCheck.onApplicantSubmitted'))

    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({
      levelName: 'enhanced-kyc-level',
      status: 'pending',
    }))
  })

  it('does not start the SDK after the verification dialog closes during token loading', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })))
    const user = userEvent.setup()
    const view = render(
      <TradingOnboardingDialogs {...createProps({ activeModal: 'sumsub' })} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start verification' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    view.rerender(<TradingOnboardingDialogs {...createProps({ activeModal: null })} />)

    await act(async () => {
      resolveFetch?.(new Response(
        JSON.stringify({ token: 'access-token' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      await Promise.resolve()
    })

    expect(sdkMocks.init).not.toHaveBeenCalled()
    expect(sdkMocks.launch).not.toHaveBeenCalled()
  })

  it('does not let the username step close from dialog dismissal controls', async () => {
    const user = userEvent.setup()
    const onModalOpenChange = vi.fn()

    render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'username',
          onModalOpenChange,
        })}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(onModalOpenChange).not.toHaveBeenCalled()
  })

  it('only lets the explicit email skip button skip the email step', async () => {
    const user = userEvent.setup()
    const onModalOpenChange = vi.fn()
    const onEmailSkip = vi.fn()

    render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'email',
          onModalOpenChange,
          onEmailSkip,
        })}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(onModalOpenChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Do this later' }))

    expect(onEmailSkip).toHaveBeenCalledTimes(1)
  })

  it('keeps enable trading non-dismissible until an error appears', async () => {
    const user = userEvent.setup()
    const onModalOpenChange = vi.fn()

    const view = render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'enable',
          onModalOpenChange,
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(onModalOpenChange).not.toHaveBeenCalled()

    view.rerender(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'enable',
          enableTradingError: 'Relayer is unavailable.',
          onModalOpenChange,
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()

    onModalOpenChange.mockClear()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(onModalOpenChange).toHaveBeenCalledWith('enable', false)
    })
  })

  it('keeps enable trading status non-dismissible until an error appears', async () => {
    const user = userEvent.setup()
    const onModalOpenChange = vi.fn()

    const view = render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'enable-status',
          hasDeployedDepositWallet: true,
          onModalOpenChange,
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(onModalOpenChange).not.toHaveBeenCalled()

    view.rerender(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'enable-status',
          enableTradingError: 'Relayer is unavailable.',
          hasDeployedDepositWallet: true,
          onModalOpenChange,
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()

    onModalOpenChange.mockClear()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(onModalOpenChange).toHaveBeenCalledWith('enable-status', false)
    })
  })

  it('keeps approve tokens non-dismissible until an error appears', async () => {
    const user = userEvent.setup()
    const onModalOpenChange = vi.fn()

    const view = render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'approve',
          onModalOpenChange,
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(onModalOpenChange).not.toHaveBeenCalled()

    view.rerender(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'approve',
          onModalOpenChange,
          tokenApprovalError: 'Relayer is unavailable.',
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()

    onModalOpenChange.mockClear()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(onModalOpenChange).toHaveBeenCalledWith('approve', false)
    })
  })

  it('renders onboarding surfaces as drawers on mobile', () => {
    mocks.useIsMobile.mockReturnValue(true)

    render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'enable',
          enableTradingError: 'Relayer is unavailable.',
        })}
      />,
    )

    expect(document.querySelector('[data-slot="drawer-content"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument()
  })
})

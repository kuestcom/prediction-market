import type { ComponentProps } from 'react'

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import TradingOnboardingDialogs from '@/app/[locale]/(platform)/_components/TradingOnboardingDialogs'

import { hoisted, stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  useIsMobile: mock(() => false),
}))

const sdkMocks = hoisted(() => ({
  destroy: mock(),
  init: mock(),
  launch: mock(),
  messageHandler: null as ((type: string) => void) | null,
}))

void mock.module('@sumsub/websdk', () => ({
  default: { init: sdkMocks.init },
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

void mock.module('@/app/[locale]/(platform)/_actions/deposit-wallet', () => ({
  checkUsernameAvailabilityAction: mock(),
}))

void mock.module('@/app/[locale]/(platform)/_components/TradingDialogs', () => ({
  FundAccountDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="fund-account-dialog" /> : null),
}))

void mock.module('@/app/[locale]/(platform)/_components/WalletFlow', () => ({
  WalletFlow: () => null,
}))

void mock.module('@/i18n/navigation', () => ({
  Link: function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

void mock.module('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => ({ name: 'Kuest' }),
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

type TradingOnboardingDialogsProps = ComponentProps<typeof TradingOnboardingDialogs>

function createProps(overrides: Partial<TradingOnboardingDialogsProps> = {}): TradingOnboardingDialogsProps {
  return {
    activeModal: null,
    onModalOpenChange: mock(),
    usernameDefaultValue: '',
    usernameError: null,
    isUsernameSubmitting: false,
    onUsernameSubmit: mock(),
    emailDefaultValue: '',
    emailError: null,
    isEmailSubmitting: false,
    onEmailSubmit: mock(),
    onEmailSkip: mock(),
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
    onSumsubStatusChange: mock(),
    enableTradingStep: 'idle',
    enableTradingError: null,
    onCreateDepositWallet: mock(),
    onEnableTradingAuth: mock(),
    hasDeployedDepositWallet: false,
    hasTradingAuth: false,
    hasTokenApprovals: false,
    approvalsStep: 'idle',
    tokenApprovalError: null,
    onApproveTokens: mock(),
    autoRedeemStep: 'idle',
    autoRedeemError: null,
    onApproveAutoRedeem: mock(),
    fundModalOpen: false,
    onFundOpenChange: mock(),
    onFundDeposit: mock(),
    depositModalOpen: false,
    onDepositOpenChange: mock(),
    withdrawModalOpen: false,
    onWithdrawOpenChange: mock(),
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
      build: mock(() => ({ destroy: sdkMocks.destroy, launch: sdkMocks.launch })),
      onMessage: mock((handler: (type: string) => void) => {
        sdkMocks.messageHandler = handler
        return sdkBuilder
      }),
      withConf: mock(() => sdkBuilder),
      withOptions: mock(() => sdkBuilder),
    }
    sdkMocks.init.mockReturnValue(sdkBuilder)
  })

  afterEach(() => {
    unstubAllGlobals()
  })

  it.each([
    ['pending', 'Verification is under review'],
    ['on_hold', 'Verification is on hold'],
    ['approved', 'Identity verified'],
    ['rejected', 'Verification rejected'],
    ['error', 'Verification status is temporarily unavailable'],
  ] as const)('renders the accessible Sumsub %s state', (status, label) => {
    render(
      <TradingOnboardingDialogs
        {...createProps({
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
    const onModalOpenChange = mock()
    render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'sumsub',
          onModalOpenChange,
          sumsubStatus: {
            ...createProps().sumsubStatus,
            enforcement: 'observe',
          },
        })}
      />,
    )

    expect(
      screen.getByText('Verification is optional and will not block your account in Observe only mode.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onModalOpenChange).toHaveBeenCalledWith('sumsub', false)
  })

  it('uses the latest verification state when the SDK reports submission', async () => {
    stubGlobal(
      'fetch',
      mock().mockResolvedValue(
        new Response(JSON.stringify({ token: 'access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const user = userEvent.setup()
    const onStatusChange = mock()
    const initialStatus = createProps().sumsubStatus
    const view = render(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'sumsub',
          onSumsubStatusChange: onStatusChange,
          sumsubStatus: initialStatus,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Start verification' }))
    await waitFor(() => expect(sdkMocks.messageHandler).toBeTypeOf('function'))

    view.rerender(
      <TradingOnboardingDialogs
        {...createProps({
          activeModal: 'sumsub',
          onSumsubStatusChange: onStatusChange,
          sumsubStatus: { ...initialStatus, levelName: 'enhanced-kyc-level' },
        })}
      />,
    )
    act(() => sdkMocks.messageHandler?.('idCheck.onApplicantSubmitted'))

    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        levelName: 'enhanced-kyc-level',
        status: 'pending',
      }),
    )
  })

  it('does not start the SDK after the verification dialog closes during token loading', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    stubGlobal(
      'fetch',
      mock().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          }),
      ),
    )
    const user = userEvent.setup()
    const view = render(<TradingOnboardingDialogs {...createProps({ activeModal: 'sumsub' })} />)

    await user.click(screen.getByRole('button', { name: 'Start verification' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    view.rerender(<TradingOnboardingDialogs {...createProps({ activeModal: null })} />)

    await act(async () => {
      resolveFetch?.(
        new Response(JSON.stringify({ token: 'access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      await Promise.resolve()
    })

    expect(sdkMocks.init).not.toHaveBeenCalled()
    expect(sdkMocks.launch).not.toHaveBeenCalled()
  })

  it('does not let the username step close from dialog dismissal controls', async () => {
    const user = userEvent.setup()
    const onModalOpenChange = mock()

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
    const onModalOpenChange = mock()
    const onEmailSkip = mock()

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
    const onModalOpenChange = mock()

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
    const onModalOpenChange = mock()

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
    const onModalOpenChange = mock()

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

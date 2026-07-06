import type { ComponentProps } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradingOnboardingDialogs from '@/app/[locale]/(platform)/_components/TradingOnboardingDialogs'

const mocks = vi.hoisted(() => ({
  useIsMobile: vi.fn(() => false),
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

vi.mock('@/components/AppLink', () => ({
  default: function MockAppLink({ children, href, ...props }: any) {
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

import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import WalletSendForm from '@/app/[locale]/(platform)/_components/wallet-modal/WalletSendForm'

const mocks = vi.hoisted(() => ({
  useAppKitAccount: vi.fn(),
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => mocks.useAppKitAccount(),
}))

vi.mock('next/image', () => ({
  default: function MockImage(props: any) {
    return createElement('img', props)
  },
}))

function renderWalletSendForm(overrides: Partial<ComponentProps<typeof WalletSendForm>> = {}) {
  return render(
    <WalletSendForm
      sendTo=""
      onChangeSendTo={vi.fn()}
      sendAmount=""
      onChangeSendAmount={vi.fn()}
      isSending={false}
      onSubmitSend={event => event.preventDefault()}
      connectedWalletAddress="0x1234567890123456789012345678901234567890"
      onUseConnectedWallet={vi.fn()}
      availableBalance={100}
      {...overrides}
    />,
  )
}

describe('walletSendForm', () => {
  beforeEach(() => {
    mocks.useAppKitAccount.mockReturnValue({
      embeddedWalletInfo: undefined,
    })
  })

  it('allows using the connected wallet shortcut for external wallets', () => {
    const onUseConnectedWallet = vi.fn()

    renderWalletSendForm({ onUseConnectedWallet })

    fireEvent.click(screen.getByRole('button', { name: /use connected/i }))

    expect(onUseConnectedWallet).toHaveBeenCalledTimes(1)
  })

  it('hides the connected wallet shortcut for embedded wallets without auth provider metadata', () => {
    mocks.useAppKitAccount.mockReturnValue({
      embeddedWalletInfo: {
        user: undefined,
        accountType: undefined,
        isSmartAccountDeployed: false,
      },
    })

    renderWalletSendForm()

    expect(screen.queryByRole('button', { name: /use connected/i })).not.toBeInTheDocument()
  })
})

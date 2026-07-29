import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import EventMergeSharesDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventMergeSharesDialog'
import EventSplitSharesDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventSplitSharesDialog'

const WALLET_RECONNECT_MESSAGE = 'Your wallet connection expired. Reconnect your wallet and try again.'

const mocks = vi.hoisted(() => ({
  ensureTradingReady: vi.fn(),
  openAppKit: vi.fn(),
  signAndSubmitDepositWalletCalls: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
  },
}))

vi.mock('wagmi', () => ({
  useSignTypedData: () => ({
    signTypedDataAsync: vi.fn(),
  }),
}))

vi.mock('@/app/[locale]/(platform)/_providers/TradingOnboardingProvider', () => ({
  useTradingOnboarding: () => ({
    ensureTradingReady: mocks.ensureTradingReady,
    openTradeRequirements: vi.fn(),
  }),
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/ResponsiveTradingDialog', () => ({
  default: function MockResponsiveTradingDialog({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  },
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({
    open: mocks.openAppKit,
  }),
}))

vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: (operation: (dismissPrompt: () => void, restorePrompt: () => void) => unknown) =>
      operation(vi.fn(), vi.fn()),
  }),
}))

vi.mock('@/lib/trading-cache', () => ({
  refreshTradingPositionsAfterMutation: vi.fn(),
}))

vi.mock('@/lib/wallet/client', () => ({
  signAndSubmitDepositWalletCalls: (...args: unknown[]) => mocks.signAndSubmitDepositWalletCalls(...args),
}))

vi.mock('@/lib/wallet/transactions', () => ({
  buildMergePositionCall: vi.fn(() => ({
    to: '0x0000000000000000000000000000000000000001',
    data: '0x',
    value: '0',
  })),
  buildNegRiskSplitPositionCall: vi.fn(),
  buildSplitPositionCall: vi.fn(() => ({
    to: '0x0000000000000000000000000000000000000001',
    data: '0x',
    value: '0',
  })),
}))

vi.mock('@/stores/useNotifications', () => ({
  useNotifications: (selector: (state: { addLocalOrderFillNotification: () => void }) => unknown) =>
    selector({ addLocalOrderFillNotification: vi.fn() }),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => ({
    address: '0x0000000000000000000000000000000000000001',
    deposit_wallet_address: '0x0000000000000000000000000000000000000002',
  }),
}))

describe('event share dialogs', () => {
  beforeEach(() => {
    mocks.ensureTradingReady.mockReset()
    mocks.openAppKit.mockReset()
    mocks.signAndSubmitDepositWalletCalls.mockReset()
    mocks.toastError.mockReset()
    mocks.ensureTradingReady.mockReturnValue(true)
    mocks.openAppKit.mockResolvedValue(undefined)
    mocks.signAndSubmitDepositWalletCalls.mockResolvedValue({
      error: WALLET_RECONNECT_MESSAGE,
      code: 'wallet_connector_not_connected',
    })
  })

  it('opens AppKit when split signing reports an expired wallet connection', async () => {
    render(<EventSplitSharesDialog open availableUsdc={10} conditionId="0x01" onOpenChange={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Amount'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Split Shares' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(WALLET_RECONNECT_MESSAGE)
      expect(mocks.openAppKit).toHaveBeenCalledWith({ view: 'Connect' })
    })
  })

  it('opens AppKit when merge signing reports an expired wallet connection', async () => {
    render(<EventMergeSharesDialog open availableShares={10} conditionId="0x01" onOpenChange={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Amount'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Merge Shares' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(WALLET_RECONNECT_MESSAGE)
      expect(mocks.openAppKit).toHaveBeenCalledWith({ view: 'Connect' })
    })
  })
})

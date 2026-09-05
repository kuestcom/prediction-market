import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const WALLET_RECONNECT_MESSAGE = 'Your wallet connection expired. Reconnect your wallet and try again.'

const mocks = hoisted(() => ({
  ensureTradingReady: mock(),
  openAppKit: mock(),
  signAndSubmitDepositWalletCalls: mock(),
  toastError: mock(),
}))

void mock.module('@tanstack/react-query', () => ({
  useQuery: mock(),
  useQueryClient: () => ({
    invalidateQueries: mock(),
  }),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

void mock.module('@/components/ui/toast', () => ({
  toast: {
    error: mocks.toastError,
    success: mock(),
  },
}))

void mock.module('wagmi', () => ({
  useSignTypedData: () => ({
    signTypedDataAsync: mock(),
  }),
}))

void mock.module('@/app/[locale]/(platform)/_providers/TradingOnboardingProvider', () => ({
  useTradingOnboarding: () => ({
    ensureTradingReady: mocks.ensureTradingReady,
    openTradeRequirements: mock(),
  }),
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_components/ResponsiveTradingDialog', () => ({
  default: function MockResponsiveTradingDialog({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  },
}))

void mock.module('@/hooks/useAppKit', () => ({
  useAppKit: () => ({
    open: mocks.openAppKit,
  }),
}))

void mock.module('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: (operation: (dismissPrompt: () => void, restorePrompt: () => void) => unknown) =>
      operation(mock(), mock()),
  }),
}))

void mock.module('@/lib/trading-cache', () => ({
  refreshTradingPositionsAfterMutation: mock(),
}))

void mock.module('@/lib/wallet/client', () => ({
  signAndSubmitDepositWalletCalls: (...args: unknown[]) => mocks.signAndSubmitDepositWalletCalls(...args),
}))

void mock.module('@/lib/wallet/transactions', () => ({
  buildMergePositionCall: mock(() => ({
    to: '0x0000000000000000000000000000000000000001',
    data: '0x',
    value: '0',
  })),
  buildNegRiskSplitPositionCall: mock(),
  buildSplitPositionCall: mock(() => ({
    to: '0x0000000000000000000000000000000000000001',
    data: '0x',
    value: '0',
  })),
}))

void mock.module('@/stores/useNotifications', () => ({
  useNotifications: (selector: (state: { addLocalOrderFillNotification: () => void }) => unknown) =>
    selector({ addLocalOrderFillNotification: mock() }),
}))

void mock.module('@/stores/useUser', () => ({
  useUser: () => ({
    address: '0x0000000000000000000000000000000000000001',
    deposit_wallet_address: '0x0000000000000000000000000000000000000002',
  }),
}))

const { default: EventMergeSharesDialog } =
  await import('@/app/[locale]/(platform)/event/[slug]/_components/EventMergeSharesDialog')
const { default: EventSplitSharesDialog } =
  await import('@/app/[locale]/(platform)/event/[slug]/_components/EventSplitSharesDialog')

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
    render(<EventSplitSharesDialog open availableUsdc={10} conditionId="0x01" onOpenChange={mock()} />)

    await userEvent.type(screen.getByLabelText('Amount'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Split Shares' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(WALLET_RECONNECT_MESSAGE)
      expect(mocks.openAppKit).toHaveBeenCalledWith({ view: 'Connect' })
    })
  })

  it('opens AppKit when merge signing reports an expired wallet connection', async () => {
    render(<EventMergeSharesDialog open availableShares={10} conditionId="0x01" onOpenChange={mock()} />)

    await userEvent.type(screen.getByLabelText('Amount'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Merge Shares' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(WALLET_RECONNECT_MESSAGE)
      expect(mocks.openAppKit).toHaveBeenCalledWith({ view: 'Connect' })
    })
  })
})

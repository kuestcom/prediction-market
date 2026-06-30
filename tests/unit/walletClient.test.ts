import { describe, expect, it, vi } from 'vitest'
import { WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE } from '@/lib/wallet'

const mocks = vi.hoisted(() => ({
  getDepositWalletNonceAction: vi.fn(),
  submitDepositWalletTransactionAction: vi.fn(),
}))

vi.mock('@/app/[locale]/(platform)/_actions/approve-tokens', () => ({
  getDepositWalletNonceAction: mocks.getDepositWalletNonceAction,
  submitDepositWalletTransactionAction: mocks.submitDepositWalletTransactionAction,
}))

const { signAndSubmitDepositWalletCalls } = await import('@/lib/wallet/client')

describe('wallet client', () => {
  it('maps stale wagmi connector signature failures to a reconnect result', async () => {
    mocks.getDepositWalletNonceAction.mockResolvedValue({
      error: null,
      nonce: '1',
    })

    const result = await signAndSubmitDepositWalletCalls({
      user: {
        address: '0x0000000000000000000000000000000000000001',
        deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      },
      calls: [
        {
          target: '0x0000000000000000000000000000000000000003',
          value: '0',
          data: '0x',
        },
      ],
      signTypedDataAsync: vi.fn().mockRejectedValue({
        name: 'ConnectorNotConnectedError',
        message: 'Connector not connected.\n\nVersion:\n@wagmi/core@2.22.1',
      }),
    })

    expect(result).toEqual({
      error: WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE,
      code: 'wallet_connector_not_connected',
    })
    expect(mocks.submitDepositWalletTransactionAction).not.toHaveBeenCalled()
  })
})

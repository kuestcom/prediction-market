import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE } from '@/lib/wallet'

const mocks = vi.hoisted(() => ({
  getDepositWalletNonceAction: vi.fn(),
  submitDepositWalletTransactionAction: vi.fn(),
}))

vi.mock('@/app/[locale]/(platform)/_actions/approve-tokens', () => ({
  getDepositWalletNonceAction: mocks.getDepositWalletNonceAction,
  submitDepositWalletTransactionAction: mocks.submitDepositWalletTransactionAction,
}))

const {
  DepositWalletCallItemsSplitFallbackError,
  signAndSubmitDepositWalletCallItemsWithSplitFallback,
  signAndSubmitDepositWalletCalls,
} = await import('@/lib/wallet/client')

describe('wallet client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
      metadata: 'send_tokens',
    })

    expect(result).toEqual({
      error: WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE,
      code: 'wallet_connector_not_connected',
    })
    expect(mocks.submitDepositWalletTransactionAction).not.toHaveBeenCalled()
    expect(mocks.getDepositWalletNonceAction).toHaveBeenCalledWith('send_tokens')
  })

  it('restores and dismisses the signature prompt for every nonce-mismatch retry', async () => {
    mocks.getDepositWalletNonceAction
      .mockResolvedValueOnce({ error: null, nonce: '1' })
      .mockResolvedValueOnce({ error: null, nonce: '2' })
    mocks.submitDepositWalletTransactionAction
      .mockResolvedValueOnce({ error: 'Nonce changed.', code: 'wallet_nonce_mismatch' })
      .mockResolvedValueOnce({ error: null, txHash: '0x2' })
    const onSigning = vi.fn()
    const onSigned = vi.fn()

    const result = await signAndSubmitDepositWalletCalls({
      user: {
        address: '0x0000000000000000000000000000000000000001',
        deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      },
      calls: [{
        target: '0x0000000000000000000000000000000000000003',
        value: '0',
        data: '0x',
      }],
      signTypedDataAsync: vi.fn().mockResolvedValue('0xsignature'),
      onSigning,
      onSigned,
    })

    expect(result).toEqual({ error: null, txHash: '0x2' })
    expect(onSigning).toHaveBeenCalledTimes(2)
    expect(onSigned).toHaveBeenCalledTimes(2)
  })

  it('includes unprocessed items when a later limited chunk throws after a partial submit', async () => {
    mocks.getDepositWalletNonceAction.mockResolvedValue({
      error: null,
      nonce: '1',
    })
    mocks.submitDepositWalletTransactionAction
      .mockResolvedValueOnce({ error: null, txHash: '0x1' })
      .mockRejectedValueOnce(new Error('submit unavailable'))

    const request = signAndSubmitDepositWalletCallItemsWithSplitFallback({
      user: {
        address: '0x0000000000000000000000000000000000000001',
        deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      },
      items: [1, 2, 3, 4, 5],
      getCall: () => ({
        target: '0x0000000000000000000000000000000000000003',
        value: '0',
        data: '0x',
      }),
      maxChunkSize: 2,
      signTypedDataAsync: vi.fn().mockResolvedValue('0xsignature'),
    })

    await expect(request).rejects.toMatchObject({
      successfulItems: [1, 2],
      failedItems: [3, 4, 5],
    })
    await expect(request).rejects.toBeInstanceOf(DepositWalletCallItemsSplitFallbackError)
  })

  it('stops submitting remaining chunks when trading auth is required', async () => {
    mocks.getDepositWalletNonceAction.mockResolvedValue({
      error: null,
      nonce: '1',
    })
    mocks.submitDepositWalletTransactionAction.mockResolvedValueOnce({
      error: 'Enable trading to continue.',
    })
    const signTypedDataAsync = vi.fn().mockResolvedValue('0xsignature')
    const onProgress = vi.fn()

    const result = await signAndSubmitDepositWalletCallItemsWithSplitFallback({
      user: {
        address: '0x0000000000000000000000000000000000000001',
        deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      },
      items: [1, 2, 3, 4, 5],
      getCall: () => ({
        target: '0x0000000000000000000000000000000000000003',
        value: '0',
        data: '0x',
      }),
      maxChunkSize: 2,
      signTypedDataAsync,
      onProgress,
    })

    expect(result).toMatchObject({
      error: 'Enable trading to continue.',
      successfulItems: [],
      failedItems: [1, 2, 3, 4, 5],
      partialFailure: false,
    })
    expect(signTypedDataAsync).toHaveBeenCalledTimes(1)
    expect(mocks.submitDepositWalletTransactionAction).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenLastCalledWith({
      successfulItems: [],
      failedItems: [1, 2, 3, 4, 5],
    })
  })
})

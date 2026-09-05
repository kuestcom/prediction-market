import { afterEach, beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'

import { hoisted, spyOn, stubEnv, stubGlobal, unstubAllEnvs, unstubAllGlobals } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  buildClobHmacSignature: mock(() => 'signature'),
  fetch: mock(),
  getUserTradingAuthSecrets: mock(),
}))

void mock.module('@/lib/hmac', () => ({
  buildClobHmacSignature: mocks.buildClobHmacSignature,
}))

void mock.module('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: mocks.getUserTradingAuthSecrets,
}))

describe('syncBuilderFeesForAdmin', () => {
  const payload = {
    feeRecipientWallet: '0x1111111111111111111111111111111111111111',
    builderTakerFeeShareBps: 3000,
    builderMakerFlatFeeBps: 25,
  }

  beforeEach(() => {
    stubEnv('RELAYER_URL', 'https://relayer.test')
    stubGlobal('fetch', mocks.fetch)
    mocks.buildClobHmacSignature.mockReset()
    mocks.buildClobHmacSignature.mockReturnValue('signature')
    mocks.fetch.mockReset()
    mocks.getUserTradingAuthSecrets.mockReset()
    mocks.getUserTradingAuthSecrets.mockResolvedValue({
      relayer: {
        key: 'key',
        secret: 'secret',
        passphrase: 'passphrase',
      },
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    unstubAllEnvs()
    unstubAllGlobals()
  })

  it('uses message-based relayer errors', async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      json: mock().mockResolvedValue({ message: 'builder taker fee exceeds cap' }),
    })

    const { syncBuilderFeesForAdmin } = await import('@/lib/affiliate-fee-sync')

    await expect(
      syncBuilderFeesForAdmin(
        {
          id: 'admin-1',
          address: '0x1111111111111111111111111111111111111111',
        },
        payload,
      ),
    ).rejects.toThrow('builder taker fee exceeds cap')
  })

  it('maps relayer transport failures to the default error', async () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    const { syncBuilderFeesForAdmin } = await import('@/lib/affiliate-fee-sync')

    await expect(
      syncBuilderFeesForAdmin(
        {
          id: 'admin-1',
          address: '0x1111111111111111111111111111111111111111',
        },
        payload,
      ),
    ).rejects.toThrow(DEFAULT_ERROR_MESSAGE)
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'

const mocks = vi.hoisted(() => ({
  buildClobHmacSignature: vi.fn(() => 'signature'),
  fetch: vi.fn(),
  getUserTradingAuthSecrets: vi.fn(),
}))

vi.mock('@/lib/hmac', () => ({
  buildClobHmacSignature: mocks.buildClobHmacSignature,
}))

vi.mock('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: mocks.getUserTradingAuthSecrets,
}))

describe('syncBuilderFeesForAdmin', () => {
  const payload = {
    feeRecipientWallet: '0x1111111111111111111111111111111111111111',
    builderTakerFeeBps: 250,
    builderMakerFeeBps: 125,
  }

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('RELAYER_URL', 'https://relayer.test')
    vi.stubGlobal('fetch', mocks.fetch)
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
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses message-based relayer errors', async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: 'builder taker fee exceeds cap' }),
    })

    const { syncBuilderFeesForAdmin } = await import('@/lib/affiliate-fee-sync')

    await expect(syncBuilderFeesForAdmin({
      id: 'admin-1',
      address: '0x1111111111111111111111111111111111111111',
    }, payload)).rejects.toThrow('builder taker fee exceeds cap')
  })

  it('maps relayer transport failures to the default error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    const { syncBuilderFeesForAdmin } = await import('@/lib/affiliate-fee-sync')

    await expect(syncBuilderFeesForAdmin({
      id: 'admin-1',
      address: '0x1111111111111111111111111111111111111111',
    }, payload)).rejects.toThrow(DEFAULT_ERROR_MESSAGE)
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})

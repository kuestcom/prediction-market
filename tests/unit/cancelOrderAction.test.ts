import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'

const mocks = vi.hoisted(() => ({
  buildClobHmacSignature: vi.fn(() => 'sig'),
  getUserTradingAuthSecrets: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/hmac', () => ({
  buildClobHmacSignature: mocks.buildClobHmacSignature,
}))

vi.mock('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: mocks.getUserTradingAuthSecrets,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

describe('cancelOrderAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.buildClobHmacSignature.mockReset()
    mocks.getUserTradingAuthSecrets.mockReset()
    mocks.getCurrentUser.mockReset()
  })

  it('rejects unauthenticated users', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { cancelOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/cancel-order')
    expect(await cancelOrderAction('order-1')).toEqual({ error: 'Unauthenticated.' })
  })

  it('requires trading auth and proxy wallet', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      address: '0x0000000000000000000000000000000000000001',
      proxy_wallet_address: null,
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({ clob: null })

    const { cancelOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/cancel-order')
    expect(await cancelOrderAction('order-1')).toEqual({ error: TRADING_AUTH_REQUIRED_ERROR })

    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({ clob: { key: 'k', passphrase: 'p', secret: 's' } })
    expect(await cancelOrderAction('order-1')).toEqual({ error: 'Deploy your proxy wallet before trading.' })
  })

  it('maps CLOB HTTP errors to user-facing messages', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: '0x0000000000000000000000000000000000000001',
      proxy_wallet_address: '0x0000000000000000000000000000000000000002',
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({ clob: { key: 'k', passphrase: 'p', secret: 's' } })

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not found' }),
    }) as any

    const { cancelOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/cancel-order')
    expect(await cancelOrderAction('order-1')).toEqual({ error: 'Order not found.' })
  })

  it('cancels remotely then marks the local order cancelled', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: '0x0000000000000000000000000000000000000001',
      proxy_wallet_address: '0x0000000000000000000000000000000000000002',
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({ clob: { key: 'k', passphrase: 'p', secret: 's' } })

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as any

    const { cancelOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/cancel-order')
    expect(await cancelOrderAction('order-1')).toEqual({ error: null })
  })
})

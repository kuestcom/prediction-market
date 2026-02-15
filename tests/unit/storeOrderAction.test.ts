import type { storeOrderAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/store-order'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'

type StoreOrderInput = Parameters<typeof storeOrderAction>[0]

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  createPublicClient: vi.fn(),
  http: vi.fn(() => ({ transport: 'http' })),
  buildClobHmacSignature: vi.fn(() => 'sig'),
  getUserTradingAuthSecrets: vi.fn(),
  getCurrentUser: vi.fn(),
  createOrder: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('next/cache', () => ({
  updateTag: mocks.updateTag,
}))

vi.mock('viem', () => ({
  createPublicClient: mocks.createPublicClient,
  erc1155Abi: [],
  http: mocks.http,
}))

vi.mock('@/lib/appkit', () => ({
  defaultNetwork: { rpcUrls: { default: { http: ['https://rpc.local'] } } },
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

vi.mock('@/lib/db/queries/order', () => ({
  OrderRepository: { createOrder: (...args: any[]) => mocks.createOrder(...args) },
}))

describe('storeOrderAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.updateTag.mockReset()
    mocks.createPublicClient.mockReset()
    mocks.http.mockClear()
    mocks.buildClobHmacSignature.mockReset()
    mocks.getUserTradingAuthSecrets.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.createOrder.mockReset()
  })

  function address(lastByte: string) {
    return (`0x${'0'.repeat(40 - lastByte.length)}${lastByte}`) as const
  }

  function basePayload(overrides: Partial<StoreOrderInput> = {}): StoreOrderInput {
    return {
      salt: '1',
      maker: address('01'),
      signer: address('01'),
      taker: address('00'),
      token_id: '1',
      maker_amount: '100',
      taker_amount: '200',
      expiration: '999',
      nonce: '0',
      fee_rate_bps: '200',
      side: 0,
      signature_type: 0,
      signature: '0xsig',
      type: 'MARKET',
      condition_id: 'cond-1',
      slug: 'event-1',
      ...overrides,
    }
  }

  it('rejects unauthenticated users', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction(basePayload())
    expect(result).toEqual({ error: 'Unauthenticated.' })
  })

  it('requires trading auth and proxy wallet', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const baseUser = {
      id: 'user-1',
      address: address('aa'),
      proxy_wallet_address: null,
      settings: {},
    }
    mocks.getCurrentUser.mockResolvedValueOnce(baseUser)
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({ clob: null })

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction(basePayload())
    expect(result?.error).toBe(TRADING_AUTH_REQUIRED_ERROR)

    mocks.getCurrentUser.mockResolvedValueOnce(baseUser)
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })
    const result2 = await storeOrderAction(basePayload())
    expect(result2?.error).toBe('Deploy your proxy wallet before trading.')
  })

  it('returns schema validation errors', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      proxy_wallet_address: address('01'),
      settings: {},
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction({} as any)
    expect(typeof result?.error).toBe('string')
    expect(result?.error?.length).toBeGreaterThan(0)
  })

  it('blocks SELL orders with insufficient shares', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const proxy = address('01')
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      proxy_wallet_address: proxy,
      settings: {},
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })
    mocks.createPublicClient.mockReturnValueOnce({
      readContract: vi.fn().mockResolvedValue(0n),
    })

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction(basePayload({
      side: 1,
      maker: proxy,
      maker_amount: '10',
      type: 'MARKET',
    }))

    expect(result).toEqual({
      error: 'Insufficient shares available. Reduce the sell amount or split more shares.',
    })
  })

  it('submits to CLOB, updates tags, and schedules local order creation', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const proxy = address('01')

    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      proxy_wallet_address: proxy,
      referred_by_user_id: null,
      settings: { trading: { market_order_type: 'FAK' } },
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        status: 201,
        statusText: 'Created',
        ok: true,
        json: async () => ({ orderId: 'clob-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: { id: 'clob-123', status: 'live', sizeMatched: '1.23' } }),
      })
    globalThis.fetch = fetchMock as any

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction(basePayload({
      maker: proxy,
      signer: proxy,
      type: 'MARKET',
    }))

    expect(result).toBeUndefined()
    expect(fetchMock).toHaveBeenCalled()
    expect(mocks.updateTag).toHaveBeenCalledTimes(2)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      clob_order_id: 'clob-123',
      user_id: 'user-1',
      condition_id: 'cond-1',
      slug: 'event-1',
    }))
  })

  it('returns default message for unmapped CLOB errors', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const proxy = address('01')

    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      proxy_wallet_address: proxy,
      referred_by_user_id: null,
      settings: { trading: { market_order_type: 'FAK' } },
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })

    const fetchMock = vi.fn().mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      ok: true,
      json: async () => ({ success: false, errorMsg: 'some internal-only clob detail' }),
    })
    globalThis.fetch = fetchMock as any

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction(basePayload({
      maker: proxy,
      signer: proxy,
      type: 'MARKET',
    }))

    expect(result).toEqual({
      error: 'Something went wrong while processing your order. Please try again.',
    })
  })
})

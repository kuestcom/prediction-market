import type {
  storeOrderAction,
  storeOrdersAction,
} from '@/app/[locale]/(platform)/event/[slug]/_actions/store-order'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'

const sumsubMocks = vi.hoisted(() => ({ requireApproval: vi.fn() }))

vi.mock('@/lib/sumsub/enforcement', () => ({
  requireSumsubTradingApproval: sumsubMocks.requireApproval,
  SUMSUB_APPROVAL_REQUIRED_MESSAGE: 'Complete identity verification to continue.',
}))

type StoreOrderInput = Parameters<typeof storeOrderAction>[0]
type StoreOrdersInput = Parameters<typeof storeOrdersAction>[0]

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  createPublicClient: vi.fn(),
  http: vi.fn(() => ({ transport: 'http' })),
  buildClobHmacSignature: vi.fn(() => 'sig'),
  getUserTradingAuthSecrets: vi.fn(),
  getExtracted: vi.fn(),
  getCurrentUser: vi.fn(),
  createOrder: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('next/cache', () => ({
  updateTag: mocks.updateTag,
}))

vi.mock('next-intl/server', () => ({
  getExtracted: (...args: any[]) => mocks.getExtracted(...args),
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
    mocks.getExtracted.mockReset()
    mocks.getExtracted.mockResolvedValue((message: string) => message)
    mocks.getCurrentUser.mockReset()
    mocks.createOrder.mockReset()
    sumsubMocks.requireApproval.mockReset().mockResolvedValue({ allowed: true })
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
      signature_type: 3,
      timestamp: '1700000000000',
      metadata: '0x0000000000000000000000000000000000000000000000000000000000000000',
      builder: '0x0000000000000000000000000000000000000000000000000000000000000000',
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
    expect(mocks.getCurrentUser).toHaveBeenCalledWith({ disableCookieCache: true, minimal: true })
  })

  it('blocks order storage before reading credentials or calling the CLOB', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    sumsubMocks.requireApproval.mockResolvedValueOnce({ allowed: false })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockClear()

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    await expect(storeOrderAction(basePayload())).resolves.toEqual({
      error: 'Complete identity verification to continue.',
    })
    expect(mocks.getUserTradingAuthSecrets).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('requires trading auth and Deposit Wallet', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const baseUser = {
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: null,
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
    expect(result2?.error).toBe('Set up your Deposit Wallet before trading.')
  })

  it('returns schema validation errors', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: address('01'),
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

  it('returns translated friendly error for SELL orders with insufficient shares', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const depositWallet = address('01')
    mocks.getExtracted.mockResolvedValueOnce((message: string) => (
      message === 'Insufficient available balance for this order.'
        ? 'Saldo disponible insuficiente para esta orden.'
        : message
    ))
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: depositWallet,
      settings: {},
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })
    const fetchMock = vi.fn().mockResolvedValueOnce({
      status: 422,
      statusText: 'Unprocessable Entity',
      ok: false,
      text: async () => JSON.stringify({
        errorMsg: 'not enough unlocked balance',
      }),
    })
    globalThis.fetch = fetchMock as any

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction(basePayload({
      side: 1,
      maker: depositWallet,
      signer: depositWallet,
      maker_amount: '10',
      type: 'MARKET',
    }))

    expect(result).toEqual({
      error: 'Saldo disponible insuficiente para esta orden.',
    })
  })

  it('returns friendly error for CLOB collateral balance precheck failures', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const depositWallet = address('01')
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: depositWallet,
      settings: {},
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })
    const fetchMock = vi.fn().mockResolvedValueOnce({
      status: 422,
      statusText: 'Unprocessable Entity',
      ok: false,
      text: async () => JSON.stringify({
        error: 'collateral balance 9980000 below required 10179600',
      }),
    })
    globalThis.fetch = fetchMock as any

    const { storeOrderAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrderAction(basePayload({
      maker: depositWallet,
      signer: depositWallet,
      type: 'MARKET',
    }))

    expect(result).toEqual({
      error: 'Insufficient available balance for this order.',
    })
  })

  it('submits to CLOB, updates tags, and schedules local order creation', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const depositWallet = address('01')

    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: depositWallet,
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
      maker: depositWallet,
      signer: depositWallet,
      type: 'MARKET',
    }))

    expect(result).toEqual({
      error: null,
      orderId: 'clob-123',
    })
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

  it('submits signed orders through the existing CLOB batch endpoint', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const depositWallet = address('01')
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: depositWallet,
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
      json: async () => ([
        { success: true, errorMsg: '', orderID: 'yes-123', status: 'matched' },
        { success: true, errorMsg: '', orderID: 'no-456', status: 'matched' },
      ]),
    })
    globalThis.fetch = fetchMock as any

    const { storeOrdersAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const payloads: StoreOrdersInput = [
      basePayload({ maker: depositWallet, signer: depositWallet, token_id: '1' }),
      basePayload({ maker: depositWallet, signer: depositWallet, token_id: '2', salt: '2' }),
    ]
    const result = await storeOrdersAction(payloads)

    expect(result).toEqual({
      error: null,
      results: [
        { error: null, orderId: 'yes-123' },
        { error: null, orderId: 'no-456' },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith('https://clob.local/orders', expect.objectContaining({
      method: 'POST',
    }))
    expect(mocks.buildClobHmacSignature).toHaveBeenCalledWith(
      's',
      expect.any(Number),
      'POST',
      '/orders',
      expect.any(String),
    )
    expect(mocks.updateTag).toHaveBeenCalledTimes(2)
    expect(mocks.createOrder).toHaveBeenCalledTimes(2)
  })

  it('blocks batch order storage when Sumsub approval is required', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    sumsubMocks.requireApproval.mockResolvedValueOnce({ allowed: false })
    const { storeOrdersAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    await expect(storeOrdersAction([
      basePayload(),
    ])).resolves.toEqual({
      error: 'Complete identity verification to continue.',
      results: null,
    })
    expect(mocks.getUserTradingAuthSecrets).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('preserves individual failures returned by the CLOB batch endpoint', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const depositWallet = address('01')
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: depositWallet,
      referred_by_user_id: null,
      settings: { trading: { market_order_type: 'FAK' } },
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: { key: 'k', passphrase: 'p', secret: 's' },
    })

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      ok: true,
      json: async () => ([
        { success: true, errorMsg: '', orderID: 'yes-123', status: 'matched' },
        { success: false, errorMsg: 'order couldn\'t be fully filled, FOK orders are fully filled/killed', orderID: '', status: 'unmatched' },
      ]),
    }) as any

    const { storeOrdersAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/store-order')
    const result = await storeOrdersAction([
      basePayload({ maker: depositWallet, signer: depositWallet, token_id: '1' }),
      basePayload({ maker: depositWallet, signer: depositWallet, token_id: '2', salt: '2' }),
    ])

    expect(result).toEqual({
      error: null,
      results: [
        { error: null, orderId: 'yes-123' },
        { error: 'Not enough liquidity to fully fill this order right now.', orderId: null },
      ],
    })
  })

  it('returns default message for unmapped CLOB errors', async () => {
    process.env.CLOB_URL = 'https://clob.local'
    const depositWallet = address('01')

    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: address('aa'),
      deposit_wallet_address: depositWallet,
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
      maker: depositWallet,
      signer: depositWallet,
      type: 'MARKET',
    }))

    expect(result).toEqual({
      error: 'Something went wrong while processing your order. Please try again.',
    })
  })
})

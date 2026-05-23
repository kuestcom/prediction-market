import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildClobHmacSignature: vi.fn(() => 'sig'),
  fetch: vi.fn(),
  findMany: vi.fn(),
  getCurrentUser: vi.fn(),
  getEventMarketMetadata: vi.fn(),
  getPublicAssetUrl: vi.fn((path: string) => `https://assets.test/${path}`),
  getUserTradingAuthSecrets: vi.fn(),
  runQuery: vi.fn(async (callback: () => Promise<unknown>) => await callback()),
}))

vi.mock('@/lib/db/queries/event', () => ({
  EventRepository: {
    getEventMarketMetadata: (...args: any[]) => mocks.getEventMarketMetadata(...args),
  },
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/db/utils/run-query', () => ({
  runQuery: (...args: any[]) => mocks.runQuery(...args),
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    query: {
      markets: {
        findMany: (...args: any[]) => mocks.findMany(...args),
      },
    },
  },
}))

vi.mock('@/lib/hmac', () => ({
  buildClobHmacSignature: (...args: any[]) => mocks.buildClobHmacSignature(...args),
}))

vi.mock('@/lib/storage', () => ({
  getPublicAssetUrl: (...args: any[]) => mocks.getPublicAssetUrl(...args),
}))

vi.mock('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: (...args: any[]) => mocks.getUserTradingAuthSecrets(...args),
}))

function address(lastByte: string) {
  return (`0x${'0'.repeat(40 - lastByte.length)}${lastByte}`) as const
}

describe('open orders routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('CLOB_URL', 'https://clob.local')
    vi.stubGlobal('fetch', mocks.fetch)

    mocks.buildClobHmacSignature.mockReset()
    mocks.buildClobHmacSignature.mockReturnValue('sig')
    mocks.fetch.mockReset()
    mocks.findMany.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.getEventMarketMetadata.mockReset()
    mocks.getPublicAssetUrl.mockReset()
    mocks.getPublicAssetUrl.mockImplementation((path: string) => `https://assets.test/${path}`)
    mocks.getUserTradingAuthSecrets.mockReset()
    mocks.runQuery.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes portfolio open orders and keeps GTD intact', async () => {
    const userAddress = address('01')
    const depositWallet = address('02')

    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: userAddress,
      deposit_wallet_address: depositWallet,
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: {
        key: 'api-key',
        secret: 'secret',
        passphrase: 'passphrase',
      },
    })
    mocks.findMany.mockResolvedValueOnce([
      {
        condition_id: 'cond-1',
        title: 'Market title',
        slug: 'market-slug',
        icon_url: '',
        event: {
          slug: 'event-slug',
          title: 'Event title',
          icon_url: 'event-icon.png',
        },
        condition: {
          id: 'cond-1',
          outcomes: [
            {
              token_id: 'token-1',
              outcome_text: 'Yes',
              outcome_index: 0,
            },
          ],
        },
        is_active: true,
        is_resolved: false,
      },
    ])
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: 'order-1',
          status: 'live',
          market: 'cond-1',
          original_size: '12.5',
          outcome: 'token-1',
          maker_address: depositWallet,
          price: '0.7',
          side: 'BUY',
          size_matched: '3',
          asset_id: 'token-1',
          expiration: '0',
          type: 'GTD',
          created_at: '2026-05-23T00:00:00.000Z',
          updated_at: '2026-05-23T00:01:00.000Z',
        },
      ]),
    })

    const { GET } = await import('@/app/api/open-orders/route')
    const response = await GET(new Request('https://example.com/api/open-orders?market=cond-1&next_cursor=cursor-1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: 'order-1',
          side: 'buy',
          type: 'GTD',
          status: 'live',
          price: 0.7,
          maker_amount: 8_750_000,
          taker_amount: 12_500_000,
          size_matched: 3_000_000,
          created_at: '2026-05-23T00:00:00.000Z',
          expiration: 0,
          outcome: {
            index: 0,
            text: 'Yes',
          },
          market: {
            condition_id: 'cond-1',
            title: 'Market title',
            slug: 'market-slug',
            icon_url: 'https://assets.test/event-icon.png',
            event_slug: 'event-slug',
            event_title: 'Event title',
            is_active: true,
            is_resolved: false,
          },
        },
      ],
      next_cursor: 'LTE=',
    })

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://clob.local/data/orders?maker_address=0x0000000000000000000000000000000000000002&market=cond-1&next_cursor=cursor-1',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('normalizes event open orders and keeps GTD intact', async () => {
    const userAddress = address('03')
    const depositWallet = address('04')

    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-2',
      address: userAddress,
      deposit_wallet_address: depositWallet,
    })
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: {
        key: 'api-key',
        secret: 'secret',
        passphrase: 'passphrase',
      },
    })
    mocks.getEventMarketMetadata.mockResolvedValueOnce({
      data: [
        {
          condition_id: 'cond-2',
          title: 'Event market',
          slug: 'event-market-slug',
          is_active: true,
          is_resolved: false,
          outcomes: [
            {
              token_id: 'token-2',
              outcome_text: 'No',
              outcome_index: 1,
            },
          ],
        },
      ],
      error: null,
    })
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: 'order-2',
          status: 'live',
          market: 'cond-2',
          original_size: '8',
          outcome: 'token-2',
          maker_address: depositWallet,
          price: '0.25',
          side: 'SELL',
          size_matched: '2',
          asset_id: 'token-2',
          expiration: '0',
          type: 'GTD',
          created_at: '2026-05-23T00:00:00.000Z',
          updated_at: '2026-05-23T00:01:00.000Z',
        },
      ]),
    })

    const { GET } = await import('@/app/api/events/[slug]/open-orders/route')
    const response = await GET(
      new Request('https://example.com/api/events/event-slug/open-orders?conditionId=cond-2&next_cursor=cursor-2'),
      { params: Promise.resolve({ slug: 'event-slug' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: 'order-2',
          side: 'sell',
          type: 'GTD',
          status: 'live',
          price: 0.25,
          maker_amount: 8_000_000,
          taker_amount: 2_000_000,
          size_matched: 2_000_000,
          created_at: '2026-05-23T00:00:00.000Z',
          expiration: 0,
          outcome: {
            index: 1,
            text: 'No',
          },
          market: {
            condition_id: 'cond-2',
            title: 'Event market',
            slug: 'event-market-slug',
            is_active: true,
            is_resolved: false,
          },
        },
      ],
      next_cursor: 'LTE=',
    })

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://clob.local/data/orders?market=cond-2&maker_address=0x0000000000000000000000000000000000000004&next_cursor=cursor-2',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })
})

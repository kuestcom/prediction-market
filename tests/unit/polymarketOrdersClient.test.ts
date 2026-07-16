import type { ApiKeyCreds, ClobClient } from '@polymarket/clob-client-v2'
import { ApiError } from '@polymarket/clob-client-v2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildPolymarketLimitOrder,
  deriveOrCreatePolymarketCredentials,
  ensurePolymarketOrderReady,
} from '@/lib/polymarket-orders-client'

const credentials: ApiKeyCreds = {
  key: 'key',
  secret: 'secret',
  passphrase: 'passphrase',
}

afterEach(() => {
  vi.restoreAllMocks()
})

function createAuthClient({
  deriveApiKey,
  createApiKey,
}: {
  deriveApiKey: () => Promise<ApiKeyCreds>
  createApiKey: () => Promise<ApiKeyCreds>
}) {
  return { deriveApiKey, createApiKey } as Pick<ClobClient, 'deriveApiKey' | 'createApiKey'>
}

describe('polymarket API credentials', () => {
  it('derives an existing key without attempting to create a duplicate', async () => {
    const deriveApiKey = vi.fn().mockResolvedValue(credentials)
    const createApiKey = vi.fn()

    await expect(deriveOrCreatePolymarketCredentials(createAuthClient({
      deriveApiKey,
      createApiKey,
    }))).resolves.toEqual(credentials)
    expect(deriveApiKey).toHaveBeenCalledOnce()
    expect(createApiKey).not.toHaveBeenCalled()
  })

  it('creates a key only when no key exists for the default nonce', async () => {
    const deriveApiKey = vi.fn().mockRejectedValue(new ApiError('Could not derive api key', 400, {}))
    const createApiKey = vi.fn().mockResolvedValue(credentials)

    await expect(deriveOrCreatePolymarketCredentials(createAuthClient({
      deriveApiKey,
      createApiKey,
    }))).resolves.toEqual(credentials)
    expect(createApiKey).toHaveBeenCalledOnce()
  })

  it('does not create a key after an unrelated authentication failure', async () => {
    const error = new ApiError('Service unavailable', 503, {})
    const deriveApiKey = vi.fn().mockRejectedValue(error)
    const createApiKey = vi.fn()

    await expect(deriveOrCreatePolymarketCredentials(createAuthClient({
      deriveApiKey,
      createApiKey,
    }))).rejects.toBe(error)
    expect(createApiKey).not.toHaveBeenCalled()
  })
})

describe('polymarket arbitrage order', () => {
  it('uses a fixed matched share size whose FOK maker amount has cents precision', () => {
    expect(buildPolymarketLimitOrder({
      tokenId: '123',
      price: 0.42,
      shares: 10.5,
    })).toEqual({
      tokenID: '123',
      price: 0.42,
      size: 10.5,
      side: 'BUY',
    })
  })

  it('preserves a sub-cent market tick in the Polymarket limit price', () => {
    expect(buildPolymarketLimitOrder({
      tokenId: '123',
      price: 0.423,
      shares: 10,
    })).toEqual({
      tokenID: '123',
      price: 0.423,
      size: 10,
      side: 'BUY',
    })
  })

  it('rejects a fixed-share FOK order whose maker amount has sub-cent precision', () => {
    expect(() => buildPolymarketLimitOrder({
      tokenId: '123',
      price: 0.42,
      shares: 10.25,
    })).toThrow('Polymarket FOK maker amount must use cents precision.')
  })

  it('rejects a marketable buy whose Polymarket maker amount is below one dollar', () => {
    expect(() => buildPolymarketLimitOrder({
      tokenId: '123',
      price: 0.46,
      shares: 1,
    })).toThrow('Polymarket marketable BUY amount must be at least $1.')
  })

  it('stops before signing when the server-side order preflight fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Polymarket order service is temporarily unavailable.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ))

    await expect(ensurePolymarketOrderReady('123')).rejects.toMatchObject({
      status: 503,
    })
  })
})

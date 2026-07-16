import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST as loadBooks } from '@/app/api/arbitrage/books/route'
import { GET as loadMarketInfo } from '@/app/api/arbitrage/market-info/route'
import { GET as loadPolymarketProfile } from '@/app/api/arbitrage/polymarket-profile/route'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('arbitrage upstream routes', () => {
  it('returns 502 when the Polymarket books request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'))

    const response = await loadBooks(new Request('http://localhost/api/arbitrage/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenIds: ['123'] }),
    }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'Polymarket order book unavailable.' })
  })

  it('returns 502 when the Polymarket market-info request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'))
    const conditionId = `0x${'1'.repeat(64)}`

    const response = await loadMarketInfo(new Request(
      `http://localhost/api/arbitrage/market-info?conditionId=${conditionId}`,
    ))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'Polymarket market info unavailable.' })
  })

  it('returns a not-ready profile when Gamma is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'))
    const address = `0x${'1'.repeat(40)}`

    const response = await loadPolymarketProfile(new Request(
      `http://localhost/api/arbitrage/polymarket-profile?address=${address}`,
    ))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ proxyWallet: null, ready: false })
  })
})

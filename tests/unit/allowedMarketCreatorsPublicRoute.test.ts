import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAllowedMarketCreatorWallets: vi.fn(),
  loadRuntimeThemeState: vi.fn(),
}))

vi.mock('@/lib/allowed-market-creators-server', () => ({
  loadAllowedMarketCreatorWallets: (...args: unknown[]) => mocks.loadAllowedMarketCreatorWallets(...args),
}))

vi.mock('@/lib/theme-settings', () => ({
  loadRuntimeThemeState: (...args: unknown[]) => mocks.loadRuntimeThemeState(...args),
}))

const { GET } = await import('@/app/api/allowed-market-creators/route')

describe('public allowed market creators manifest', () => {
  beforeEach(() => {
    mocks.loadAllowedMarketCreatorWallets.mockReset()
    mocks.loadRuntimeThemeState.mockReset()
    process.env.CHAIN_ID = '137'
    mocks.loadAllowedMarketCreatorWallets.mockResolvedValue({
      data: ['0x1111111111111111111111111111111111111111'],
      error: null,
    })
    mocks.loadRuntimeThemeState.mockResolvedValue({
      site: {
        name: 'Example Markets',
        pwaIcon192Url: '/icon-192.png',
        pwaIcon512Url: '/icon-512.png',
      },
    })
  })

  it('keeps wallets and publishes the versioned whitelabel discovery fields', async () => {
    const response = await GET(new Request('https://markets.example/api/allowed-market-creators'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=300')
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{64}"$/)
    await expect(response.json()).resolves.toEqual({
      wallets: ['0x1111111111111111111111111111111111111111'],
      schema_version: 1,
      chain_id: 137,
      market_status_path: '/api/markets/status',
      name: 'Example Markets',
      icons: [
        { src: '/icon-192.png', sizes: '192x192' },
        { src: '/icon-512.png', sizes: '512x512' },
      ],
    })
  })

  it('returns 304 for a matching manifest ETag', async () => {
    const first = await GET(new Request('https://markets.example/api/allowed-market-creators'))
    const etag = first.headers.get('etag')!
    const response = await GET(
      new Request('https://markets.example/api/allowed-market-creators', {
        headers: { 'If-None-Match': etag },
      }),
    )

    expect(response.status).toBe(304)
    expect(response.headers.get('etag')).toBe(etag)
    expect(await response.text()).toBe('')
  })
})

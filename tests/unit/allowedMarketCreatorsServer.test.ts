import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  listWallets: vi.fn(),
  listSiteSources: vi.fn(),
  replaceSiteSource: vi.fn(),
}))

vi.mock('@/lib/db/queries/allowed-market-creators', () => ({
  AllowedMarketCreatorRepository: {
    listWallets: (...args: any[]) => mocks.listWallets(...args),
    listSiteSources: (...args: any[]) => mocks.listSiteSources(...args),
    replaceSiteSource: (...args: any[]) => mocks.replaceSiteSource(...args),
  },
}))

describe('allowed market creators server helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.fetch.mockReset()
    mocks.listWallets.mockReset()
    mocks.listSiteSources.mockReset()
    mocks.replaceSiteSource.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes wallet lists without casing duplicates', async () => {
    const { normalizeAllowedMarketCreatorWallets } = await import('@/lib/allowed-market-creators-server')

    expect(normalizeAllowedMarketCreatorWallets([
      '0x1111111111111111111111111111111111111111',
      '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
      'not-a-wallet',
    ])).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ])
  })

  it('loads only persisted allowed creator wallets', async () => {
    mocks.listWallets.mockResolvedValueOnce({
      data: ['0x1111111111111111111111111111111111111111'],
      error: null,
    })

    const { loadAllowedMarketCreatorWallets } = await import('@/lib/allowed-market-creators-server')
    await expect(loadAllowedMarketCreatorWallets()).resolves.toEqual({
      data: ['0x1111111111111111111111111111111111111111'],
      error: null,
    })
  })

  it('skips recently refreshed site sources', async () => {
    const now = new Date('2026-06-18T12:00:00.000Z')
    mocks.listSiteSources.mockResolvedValueOnce({
      data: [{
        sourceUrl: 'https://site2.com',
        displayName: 'site2.com',
        refreshedAt: now,
      }],
      error: null,
    })

    const { refreshAllowedMarketCreatorSiteSources } = await import('@/lib/allowed-market-creators-server')

    await expect(refreshAllowedMarketCreatorSiteSources({ now })).resolves.toEqual({
      scanned: 1,
      checked: 0,
      refreshed: 0,
      skippedFresh: 1,
      wallets: 0,
      errors: [],
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.replaceSiteSource).not.toHaveBeenCalled()
  })

  it('refreshes stale site sources and persists normalized wallets', async () => {
    const now = new Date('2026-06-18T12:00:00.000Z')
    mocks.listSiteSources.mockResolvedValueOnce({
      data: [{
        sourceUrl: 'https://site2.com',
        displayName: 'site2.com',
        refreshedAt: new Date('2026-06-16T12:00:00.000Z'),
      }],
      error: null,
    })
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        wallets: [
          '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
          'not-a-wallet',
        ],
      }),
    })
    mocks.replaceSiteSource.mockResolvedValueOnce({
      data: true,
      error: null,
    })

    const { refreshAllowedMarketCreatorSiteSources } = await import('@/lib/allowed-market-creators-server')

    await expect(refreshAllowedMarketCreatorSiteSources({ now })).resolves.toEqual({
      scanned: 1,
      checked: 1,
      refreshed: 1,
      skippedFresh: 0,
      wallets: 1,
      errors: [],
    })
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://site2.com/api/allowed-market-creators',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
        },
      }),
    )
    expect(mocks.replaceSiteSource).toHaveBeenCalledWith({
      sourceUrl: 'https://site2.com',
      displayName: 'site2.com',
      walletAddresses: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    })
  })
})

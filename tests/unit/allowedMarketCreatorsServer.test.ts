import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listWallets: vi.fn(),
}))

vi.mock('@/lib/db/queries/allowed-market-creators', () => ({
  AllowedMarketCreatorRepository: {
    listWallets: (...args: any[]) => mocks.listWallets(...args),
  },
}))

describe('allowed market creators server helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.listWallets.mockReset()
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
})

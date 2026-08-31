import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getAffiliateSettings } from '@/app/api/affiliate-settings/route'
import { GET as getArbitrageConfig } from '@/app/api/arbitrage/config/route'
import { GET as getGeoblockSettings } from '@/app/api/geoblock/route'
import { GET as getLiFiChains } from '@/app/api/lifi/chains/route'
import { GET as getLocales } from '@/app/api/locales/route'
import { MUTABLE_API_CACHE_CONTROL } from '@/lib/api-cache'

const mocks = vi.hoisted(() => ({
  deferPrerender: vi.fn().mockResolvedValue(undefined),
  getLiFiChains: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ data: {}, error: null }),
  io: vi.fn().mockResolvedValue(undefined),
  loadBlockedCountries: vi.fn().mockResolvedValue([]),
  loadEnabledLocales: vi.fn().mockResolvedValue(['en']),
}))

vi.mock('next/cache', () => ({
  io: mocks.io,
}))

vi.mock('@/lib/public-shell-rendering', () => ({
  deferPublicShellPrerenderIfNeeded: mocks.deferPrerender,
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: mocks.getSettings,
  },
}))

vi.mock('@/lib/geoblock-settings', () => ({
  loadBlockedCountries: mocks.loadBlockedCountries,
}))

vi.mock('@/lib/lifi', () => ({
  getLiFiServerActions: vi.fn().mockResolvedValue({ getChains: mocks.getLiFiChains }),
}))

vi.mock('@/i18n/locale-settings', () => ({
  loadEnabledLocales: mocks.loadEnabledLocales,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mutable API response caching', () => {
  it.each([
    ['affiliate settings', getAffiliateSettings],
    ['arbitrage config', getArbitrageConfig],
    ['geoblock settings', getGeoblockSettings],
    ['locales', getLocales],
  ])('requires revalidation for %s', async (_, handler) => {
    const response = await handler()

    expect(response.headers.get('cache-control')).toBe(MUTABLE_API_CACHE_CONTROL)
  })

  it.each([
    ['affiliate settings', getAffiliateSettings],
    ['arbitrage config', getArbitrageConfig],
    ['geoblock settings', getGeoblockSettings],
    ['LI.FI chains', getLiFiChains],
    ['locales', getLocales],
  ])('always loads %s at request time', async (_, handler) => {
    await handler()

    expect(mocks.io).toHaveBeenCalledOnce()
  })
})

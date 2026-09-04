import { beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import { GET as getAffiliateSettings } from '@/app/api/affiliate-settings/route'
import { GET as getArbitrageConfig } from '@/app/api/arbitrage/config/route'
import { GET as getGeoblockSettings } from '@/app/api/geoblock/route'
import { GET as getLiFiChains } from '@/app/api/lifi/chains/route'
import { GET as getLocales } from '@/app/api/locales/route'
import { MUTABLE_API_CACHE_CONTROL } from '@/lib/api-cache'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  deferPrerender: mock().mockResolvedValue(undefined),
  getLiFiChains: mock().mockResolvedValue([]),
  getSettings: mock().mockResolvedValue({ data: {}, error: null }),
  io: mock().mockResolvedValue(undefined),
  loadBlockedCountries: mock().mockResolvedValue([]),
  loadEnabledLocales: mock().mockResolvedValue(['en']),
}))

void mock.module('next/cache', () => ({
  io: mocks.io,
}))

void mock.module('@/lib/public-shell-rendering', () => ({
  deferPublicShellPrerenderIfNeeded: mocks.deferPrerender,
}))

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: mocks.getSettings,
  },
}))

void mock.module('@/lib/geoblock-settings', () => ({
  loadBlockedCountries: mocks.loadBlockedCountries,
}))

void mock.module('@/lib/lifi', () => ({
  getLiFiServerActions: mock().mockResolvedValue({ getChains: mocks.getLiFiChains }),
}))

void mock.module('@/i18n/locale-settings', () => ({
  loadEnabledLocales: mocks.loadEnabledLocales,
}))

beforeEach(() => {
  jest.clearAllMocks()
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

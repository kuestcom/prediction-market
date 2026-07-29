import { describe, expect, it, vi } from 'vitest'

import { resolveEventMarketSlugsMainTag, resolveEventTagCadenceRoute } from '@/lib/db/queries/event'

vi.mock('next/cache', () => ({
  cacheTag: vi.fn(),
  unstable_cache: (callback: unknown) => callback,
}))

describe('resolveEventTagCadenceRoute', () => {
  it('uses series cadence fallback only for Crypto subcategories', () => {
    expect(resolveEventTagCadenceRoute('daily', 'crypto')?.routeSlug).toBe('daily')
    expect(resolveEventTagCadenceRoute('daily', ' CRYPTO ')?.routeSlug).toBe('daily')
    expect(resolveEventTagCadenceRoute('daily', 'finance')).toBeNull()
    expect(resolveEventTagCadenceRoute('daily', '')).toBeNull()
  })

  it('preserves Crypto cadence handling for market-slug requests', () => {
    expect(resolveEventMarketSlugsMainTag('5M', '')).toBe('crypto')
    expect(resolveEventMarketSlugsMainTag('15M', '')).toBe('crypto')
    expect(resolveEventMarketSlugsMainTag('hourly', '')).toBe('crypto')
    expect(resolveEventMarketSlugsMainTag('4hour', '')).toBe('crypto')
    expect(resolveEventMarketSlugsMainTag('daily', '')).toBe('')
    expect(resolveEventMarketSlugsMainTag('daily', 'finance')).toBe('finance')
    expect(resolveEventMarketSlugsMainTag('daily', ' CRYPTO ')).toBe('crypto')
  })
})

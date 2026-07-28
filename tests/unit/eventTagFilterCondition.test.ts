import { describe, expect, it, vi } from 'vitest'
import { resolveEventTagCadenceRoute } from '@/lib/db/queries/event'

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
})

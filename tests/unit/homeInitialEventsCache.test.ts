import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getCachedHomeInitialCurrentTimestamp,
  getHomeInitialCurrentTimestamp,
  HOME_INITIAL_EVENTS_CACHE_LIFE,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
}))

describe('homeInitialEventsCache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses a fifteen-minute revalidation window for cached initial home events', () => {
    expect(HOME_INITIAL_EVENTS_CACHE_LIFE).toEqual({
      stale: 900,
      revalidate: 900,
      expire: 31_536_000,
    })
  })

  it('normalizes the runtime timestamp to the current fifteen-minute window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-11T12:34:56.789Z'))

    expect(getHomeInitialCurrentTimestamp()).toBe(Date.parse('2026-05-11T12:30:00.000Z'))
  })

  it('normalizes the cached prerender timestamp to the current fifteen-minute window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-11T12:34:56.789Z'))

    await expect(getCachedHomeInitialCurrentTimestamp()).resolves.toBe(Date.parse('2026-05-11T12:30:00.000Z'))
  })
})

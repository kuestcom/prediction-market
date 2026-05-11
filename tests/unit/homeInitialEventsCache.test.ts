import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getHomeInitialCurrentTimestamp,
  HOME_INITIAL_EVENTS_CACHE_LIFE,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'

describe('homeInitialEventsCache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses a one-minute revalidation window for cached initial home events', () => {
    expect(HOME_INITIAL_EVENTS_CACHE_LIFE).toEqual({
      stale: 60,
      revalidate: 60,
      expire: 900,
    })
  })

  it('normalizes the seed timestamp to the current minute', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-11T12:34:56.789Z'))

    expect(getHomeInitialCurrentTimestamp()).toBe(Date.parse('2026-05-11T12:34:00.000Z'))
  })
})

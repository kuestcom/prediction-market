import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEventsApi, fetchHomeEventsPageApi } from '@/lib/events-api'

describe('events API errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('distinguishes the generic events request error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(fetchEventsApi({ tag: 'trending', locale: 'en' }))
      .rejects
      .toThrow('Failed to fetch events')
  })

  it('adds home feed context to page request errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(fetchHomeEventsPageApi({ tag: 'trending', locale: 'en' }))
      .rejects
      .toThrow('Failed to fetch home feed events')
  })
})

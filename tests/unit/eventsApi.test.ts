import { afterEach, describe, expect, it, mock } from 'bun:test'

import { fetchEventsApi, fetchHomeEventsPageApi } from '@/lib/events-api'

import { stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

describe('events API errors', () => {
  afterEach(() => {
    unstubAllGlobals()
  })

  it('distinguishes the generic events request error', async () => {
    stubGlobal('fetch', mock().mockResolvedValue({ ok: false }))

    await expect(fetchEventsApi({ tag: 'trending', locale: 'en' })).rejects.toThrow('Failed to fetch events')
  })

  it('adds home feed context to page request errors', async () => {
    stubGlobal('fetch', mock().mockResolvedValue({ ok: false }))

    await expect(fetchHomeEventsPageApi({ tag: 'trending', locale: 'en' })).rejects.toThrow(
      'Failed to fetch home feed events',
    )
  })
})

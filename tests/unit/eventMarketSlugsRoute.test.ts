import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  listEventMarketSlugs: mock(),
}))

void mock.module('@/lib/db/queries/event', () => ({
  EventRepository: {
    listEventMarketSlugs: (...args: unknown[]) => mocks.listEventMarketSlugs(...args),
  },
}))

describe('event market slugs route', () => {
  beforeEach(() => {
    mocks.listEventMarketSlugs.mockReset()
  })

  it('forwards the selected parent category', async () => {
    mocks.listEventMarketSlugs.mockResolvedValue({
      data: ['btc-15m-market'],
      error: null,
    })

    const { GET } = await import('@/app/api/events/market-slugs/route')
    const response = await GET(new Request('http://localhost/api/events/market-slugs?tag=15M&mainTag=crypto'))

    expect(mocks.listEventMarketSlugs).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: '15M',
        mainTag: 'crypto',
      }),
    )
    await expect(response.json()).resolves.toEqual(['btc-15m-market'])
  })
})

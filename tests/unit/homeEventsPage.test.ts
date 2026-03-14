import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  filterHomeEvents: vi.fn(),
  listEvents: vi.fn(),
}))

vi.mock('@/lib/db/queries/event', () => ({
  EventRepository: {
    listEvents: (...args: any[]) => mocks.listEvents(...args),
  },
}))

vi.mock('@/lib/home-events', async () => {
  const actual = await vi.importActual<typeof import('@/lib/home-events')>('@/lib/home-events')

  return {
    ...actual,
    filterHomeEvents: (...args: any[]) => mocks.filterHomeEvents(...args),
  }
})

describe('listHomeEventsPage', () => {
  beforeEach(() => {
    mocks.listEvents.mockReset()
    mocks.filterHomeEvents.mockReset()
  })

  it('stops fetching once it has enough visible events for the requested page', async () => {
    const firstBatch = Array.from({ length: 32 }, (_, index) => ({ id: `batch-1-${index}` }))
    const secondBatch = Array.from({ length: 32 }, (_, index) => ({ id: `batch-2-${index}` }))
    const visibleAfterFirstBatch = firstBatch.slice(0, 20)
    const visibleAfterSecondBatch = [...firstBatch, ...secondBatch].slice(0, 40)

    mocks.listEvents
      .mockResolvedValueOnce({ data: firstBatch, error: null })
      .mockResolvedValueOnce({ data: secondBatch, error: null })

    mocks.filterHomeEvents
      .mockReturnValueOnce(visibleAfterFirstBatch)
      .mockReturnValueOnce(visibleAfterSecondBatch)

    const { listHomeEventsPage } = await import('@/lib/home-events-page')
    const result = await listHomeEventsPage({
      bookmarked: false,
      locale: 'en',
      mainTag: 'trending',
      tag: 'trending',
      userId: '',
    })

    expect(mocks.listEvents).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      data: visibleAfterSecondBatch.slice(0, 32),
      error: null,
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  filterHomeEvents: vi.fn(),
  listEvents: vi.fn(),
}))

vi.mock('next/cache', () => ({
  cacheTag: (...args: any[]) => mocks.cacheTag(...args),
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
  const queryBatchSize = 128

  beforeEach(() => {
    mocks.cacheTag.mockReset()
    mocks.listEvents.mockReset()
    mocks.filterHomeEvents.mockReset()
  })

  it('stops fetching early for resolved pages once it has enough visible events', async () => {
    const firstBatch = Array.from({ length: queryBatchSize }, (_, index) => ({ id: `batch-1-${index}` }))
    const secondBatch = Array.from({ length: queryBatchSize }, (_, index) => ({ id: `batch-2-${index}` }))
    const visibleAfterFirstBatch = firstBatch.slice(0, 20)
    const visibleAfterSecondBatch = [...firstBatch, ...secondBatch].slice(0, 40)

    mocks.listEvents
      .mockResolvedValueOnce({ data: firstBatch, error: null })
      .mockResolvedValueOnce({ data: secondBatch, error: null })

    mocks.filterHomeEvents
      .mockReturnValueOnce(visibleAfterFirstBatch)
      .mockReturnValueOnce(visibleAfterSecondBatch)
      .mockReturnValueOnce(visibleAfterSecondBatch)

    const { listHomeEventsPage } = await import('@/lib/home-events-page')
    const result = await listHomeEventsPage({
      bookmarked: false,
      locale: 'en',
      mainTag: 'trending',
      status: 'resolved',
      tag: 'trending',
      userId: '',
    })

    expect(mocks.filterHomeEvents).toHaveBeenCalledTimes(3)
    expect(mocks.listEvents).toHaveBeenCalledTimes(2)
    expect(mocks.listEvents).toHaveBeenNthCalledWith(1, expect.objectContaining({
      limit: queryBatchSize,
      offset: 0,
    }))
    expect(mocks.listEvents).toHaveBeenNthCalledWith(2, expect.objectContaining({
      limit: queryBatchSize,
      offset: queryBatchSize,
    }))
    expect(result).toEqual({
      data: visibleAfterSecondBatch.slice(0, 32),
      error: null,
      currentTimestamp: null,
    })
  })

  it('does not stop early for active pages because later batches can replace series entries', async () => {
    const firstBatch = Array.from({ length: queryBatchSize }, (_, index) => ({ id: `batch-1-${index}` }))
    const secondBatch = Array.from({ length: queryBatchSize }, (_, index) => ({ id: `batch-2-${index}` }))
    const thirdBatch: any[] = []
    const visibleAfterAllBatches = [...secondBatch.slice(0, 8), ...firstBatch.slice(8)]

    mocks.listEvents
      .mockResolvedValueOnce({ data: firstBatch, error: null })
      .mockResolvedValueOnce({ data: secondBatch, error: null })
      .mockResolvedValueOnce({ data: thirdBatch, error: null })

    mocks.filterHomeEvents.mockReturnValueOnce(visibleAfterAllBatches)

    const { listHomeEventsPage } = await import('@/lib/home-events-page')
    const result = await listHomeEventsPage({
      bookmarked: false,
      locale: 'en',
      mainTag: 'trending',
      status: 'active',
      tag: 'trending',
      userId: '',
    })

    expect(mocks.filterHomeEvents).toHaveBeenCalledTimes(1)
    expect(mocks.listEvents).toHaveBeenCalledTimes(3)
    expect(mocks.listEvents).toHaveBeenNthCalledWith(1, expect.objectContaining({
      limit: queryBatchSize,
      offset: 0,
    }))
    expect(mocks.listEvents).toHaveBeenNthCalledWith(2, expect.objectContaining({
      limit: queryBatchSize,
      offset: queryBatchSize,
    }))
    expect(mocks.listEvents).toHaveBeenNthCalledWith(3, expect.objectContaining({
      limit: queryBatchSize,
      offset: queryBatchSize * 2,
    }))
    expect(result).toEqual({
      data: visibleAfterAllBatches.slice(0, 32),
      error: null,
      currentTimestamp: null,
    })
  })

  it('forwards sortBy to the events repository', async () => {
    mocks.listEvents.mockResolvedValueOnce({ data: [], error: null })
    mocks.filterHomeEvents.mockReturnValueOnce([])

    const { listHomeEventsPage } = await import('@/lib/home-events-page')
    await listHomeEventsPage({
      bookmarked: false,
      locale: 'en',
      mainTag: 'trending',
      sortBy: 'trending',
      status: 'active',
      tag: 'trending',
      userId: '',
    })

    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      limit: queryBatchSize,
      sortBy: 'trending',
    }))
  })
})

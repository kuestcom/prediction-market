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

  it('queries one SQL-filtered page for resolved pages without home visibility filters', async () => {
    const resolvedPage = Array.from({ length: 32 }, (_, index) => ({ id: `resolved-${index}` }))

    mocks.listEvents.mockResolvedValueOnce({ data: resolvedPage, error: null })
    mocks.filterHomeEvents.mockReturnValueOnce(resolvedPage.slice(0, 20))

    const { listHomeEventsPage } = await import('@/lib/home-events-page')
    const result = await listHomeEventsPage({
      bookmarked: false,
      locale: 'en',
      mainTag: 'trending',
      offset: 96,
      status: 'resolved',
      tag: 'trending',
      userId: '',
    })

    expect(mocks.filterHomeEvents).not.toHaveBeenCalled()
    expect(mocks.listEvents).toHaveBeenCalledTimes(1)
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      excludeSportsAuxiliary: true,
      hideCrypto: false,
      hideEarnings: false,
      hideSports: false,
      limit: 32,
      offset: 96,
      preferResolvedDateOrder: true,
      skipLivePricing: true,
    }))
    expect(result).toEqual({
      data: resolvedPage,
      error: null,
      currentTimestamp: null,
    })
  })

  it('applies home visibility filters before slicing resolved pages with hide toggles', async () => {
    const hiddenCryptoEvents = Array.from({ length: 100 }, (_, index) => ({
      id: `crypto-event-${index}`,
      slug: `bitcoin-up-or-down-on-june-${index + 1}-2026`,
      main_tag: 'Crypto',
      tags: [{ slug: 'crypto' }],
    }))
    const visibleFinanceEvents = Array.from({ length: 36 }, (_, index) => ({
      id: `finance-event-${index}`,
      slug: `meta-up-or-down-on-june-${index + 1}-2026`,
      main_tag: 'Finance',
      tags: [{ slug: 'finance' }],
    }))
    const firstBatch = [
      ...hiddenCryptoEvents,
      ...visibleFinanceEvents.slice(0, 28),
    ]
    const secondBatch = visibleFinanceEvents.slice(28)

    mocks.listEvents
      .mockResolvedValueOnce({ data: firstBatch, error: null })
      .mockResolvedValueOnce({ data: secondBatch, error: null })
    mocks.filterHomeEvents.mockImplementation((events: any[]) =>
      events.filter(event => event.main_tag !== 'Crypto'),
    )

    const { listHomeEventsPage } = await import('@/lib/home-events-page')
    const result = await listHomeEventsPage({
      bookmarked: false,
      hideCrypto: true,
      locale: 'en',
      mainTag: 'trending',
      status: 'resolved',
      tag: 'trending',
      userId: '',
    })

    expect(mocks.listEvents).toHaveBeenCalledTimes(2)
    expect(mocks.listEvents).toHaveBeenNthCalledWith(1, expect.objectContaining({
      excludeSportsAuxiliary: true,
      hideCrypto: true,
      limit: queryBatchSize,
      offset: 0,
      preferResolvedDateOrder: true,
      skipLivePricing: true,
    }))
    expect(mocks.listEvents).toHaveBeenNthCalledWith(2, expect.objectContaining({
      excludeSportsAuxiliary: true,
      hideCrypto: true,
      hideEarnings: false,
      hideSports: false,
      limit: queryBatchSize,
      offset: queryBatchSize,
      preferResolvedDateOrder: true,
      skipLivePricing: true,
    }))
    expect(mocks.filterHomeEvents).toHaveBeenNthCalledWith(1, firstBatch, expect.objectContaining({
      hideCrypto: true,
      status: 'resolved',
    }))
    expect(mocks.filterHomeEvents).toHaveBeenNthCalledWith(2, secondBatch, expect.objectContaining({
      hideCrypto: true,
      status: 'resolved',
    }))
    expect(mocks.filterHomeEvents).toHaveBeenNthCalledWith(3, [...firstBatch, ...secondBatch], expect.objectContaining({
      hideCrypto: true,
      status: 'resolved',
    }))
    expect(result).toEqual({
      data: visibleFinanceEvents.slice(0, 32),
      error: null,
      currentTimestamp: null,
    })
  })

  it('forwards bookmarked filters to the resolved repository shortcut', async () => {
    mocks.listEvents.mockResolvedValueOnce({ data: [], error: null })

    const { listHomeEventsPage } = await import('@/lib/home-events-page')
    await listHomeEventsPage({
      bookmarked: true,
      locale: 'en',
      mainTag: 'trending',
      status: 'resolved',
      tag: 'trending',
      userId: 'user-1',
    })

    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      bookmarked: true,
      limit: 32,
      offset: 0,
      preferResolvedDateOrder: true,
      status: 'resolved',
      userId: 'user-1',
    }))
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
      sortBy: 'volume_24h',
      status: 'active',
      tag: 'trending',
      userId: '',
    })

    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      limit: queryBatchSize,
      sortBy: 'volume_24h',
    }))
  })
})

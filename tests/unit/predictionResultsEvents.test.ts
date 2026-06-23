import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
}))

vi.mock('@/lib/db/queries/event', () => ({
  EventRepository: {
    listEvents: (...args: any[]) => mocks.listEvents(...args),
  },
}))

describe('listPredictionResultsPage', () => {
  beforeEach(() => {
    mocks.listEvents.mockReset()
  })

  it('returns every matching active prediction event without compacting shared series slugs', async () => {
    const june23 = {
      id: 'doge-june-23',
      slug: 'dogecoin-up-or-down-on-june-23-2026',
      title: 'Dogecoin Up or Down on June 23?',
      status: 'active',
      series_slug: 'dogecoin-up-or-down-daily',
    }
    const june24 = {
      id: 'doge-june-24',
      slug: 'dogecoin-up-or-down-on-june-24-2026',
      title: 'Dogecoin Up or Down on June 24?',
      status: 'active',
      series_slug: 'dogecoin-up-or-down-daily',
    }

    mocks.listEvents.mockResolvedValueOnce({ data: [june23, june24], error: null })

    const { listPredictionResultsPage } = await import('@/lib/prediction-results-events')
    const result = await listPredictionResultsPage({
      bookmarked: false,
      locale: 'en',
      mainTag: 'trending',
      search: 'doge',
      status: 'active',
      tag: 'trending',
      userId: '',
    })

    expect(result).toEqual({
      data: [june23, june24],
      error: null,
    })
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      excludeSportsAuxiliary: true,
      limit: 32,
      offset: 0,
      search: 'doge',
      status: 'active',
    }))
  })

  it('uses resolved-date ordering and skips live pricing for direct resolved pages', async () => {
    mocks.listEvents.mockResolvedValueOnce({ data: [], error: null })

    const { listPredictionResultsPage } = await import('@/lib/prediction-results-events')
    await listPredictionResultsPage({
      bookmarked: false,
      locale: 'en',
      mainTag: 'crypto',
      status: 'resolved',
      tag: 'dogecoin',
      userId: '',
    })

    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      preferResolvedDateOrder: true,
      skipLivePricing: true,
      status: 'resolved',
    }))
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listPredictionResultsPage: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/prediction-results-events', () => ({
  listPredictionResultsPage: (...args: any[]) => mocks.listPredictionResultsPage(...args),
}))

const { GET } = await import('@/app/api/predictions/events/route')

describe('prediction results events route', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.listPredictionResultsPage.mockReset()
  })

  it('returns an empty payload for anonymous bookmarked prediction requests', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const response = await GET(new Request('https://example.com/api/predictions/events?bookmarked=true&locale=en'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
    expect(mocks.listPredictionResultsPage).not.toHaveBeenCalled()
  })

  it('forwards validated prediction filters to the prediction results loader', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.listPredictionResultsPage.mockResolvedValueOnce({ data: [], error: null })

    const response = await GET(new Request(
      'https://example.com/api/predictions/events?tag=dogecoin&mainTag=crypto&search=doge&sort=end_date&status=active&offset=32&locale=en',
    ))

    expect(response.status).toBe(200)
    expect(mocks.listPredictionResultsPage).toHaveBeenCalledWith(expect.objectContaining({
      locale: 'en',
      mainTag: 'crypto',
      offset: 32,
      search: 'doge',
      sortBy: 'end_date',
      status: 'active',
      tag: 'dogecoin',
      userId: 'user-1',
    }))
  })
})

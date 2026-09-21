import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  listPredictionResultsPage: mock(),
  hasTradingActivity: mock(),
  consumeDecisionModelSearchQuota: mock(),
  rankCandidatesWithDecisionModel: mock(),
  loadOpenRouterProviderSettings: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

void mock.module('@/lib/prediction-results-events', () => ({
  listPredictionResultsPage: (...args: any[]) => mocks.listPredictionResultsPage(...args),
}))

void mock.module('@/lib/ai/decision-model', () => ({
  rankCandidatesWithDecisionModel: (...args: any[]) => mocks.rankCandidatesWithDecisionModel(...args),
}))

void mock.module('@/lib/ai/decision-model-access', () => ({
  consumeDecisionModelSearchQuota: (...args: any[]) => mocks.consumeDecisionModelSearchQuota(...args),
  hasTradingActivity: (...args: any[]) => mocks.hasTradingActivity(...args),
}))

void mock.module('@/lib/ai/market-context-config', () => ({
  loadOpenRouterProviderSettings: (...args: any[]) => mocks.loadOpenRouterProviderSettings(...args),
}))

const { GET } = await import('@/app/api/predictions/events/route')

describe('prediction results events route', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.listPredictionResultsPage.mockReset()
    mocks.hasTradingActivity.mockReset().mockResolvedValue(false)
    mocks.consumeDecisionModelSearchQuota.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 3600 })
    mocks.rankCandidatesWithDecisionModel.mockReset()
    mocks.loadOpenRouterProviderSettings.mockReset().mockResolvedValue({ apiKey: '', decisionModel: '' })
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

    const response = await GET(
      new Request(
        'https://example.com/api/predictions/events?tag=dogecoin&mainTag=crypto&search=doge&sort=end_date&status=active&offset=32&locale=en',
      ),
    )

    expect(response.status).toBe(200)
    expect(mocks.listPredictionResultsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        mainTag: 'crypto',
        offset: 32,
        search: 'doge',
        sortBy: 'end_date',
        status: 'active',
        tag: 'dogecoin',
        userId: 'user-1',
      }),
    )
  })

  it('keeps the default search ordering for authenticated users without trading activity', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.listPredictionResultsPage.mockResolvedValueOnce({
      data: [
        { id: 'event-1', slug: 'event-1' },
        { id: 'event-2', slug: 'event-2' },
      ],
      error: null,
    })
    mocks.loadOpenRouterProviderSettings.mockResolvedValueOnce({
      apiKey: 'openrouter-key',
      decisionModel: 'typesafe/jev-1.13',
    })

    const response = await GET(new Request('https://example.com/api/predictions/events?search=bitcoin&locale=en'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
    ])
    expect(mocks.hasTradingActivity).toHaveBeenCalledWith('user-1')
    expect(mocks.loadOpenRouterProviderSettings).toHaveBeenCalled()
    expect(mocks.rankCandidatesWithDecisionModel).not.toHaveBeenCalled()
  })

  it('does not query trading activity when the Decision model is not configured', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.listPredictionResultsPage.mockResolvedValueOnce({
      data: [
        { id: 'event-1', slug: 'event-1' },
        { id: 'event-2', slug: 'event-2' },
      ],
      error: null,
    })

    const response = await GET(new Request('https://example.com/api/predictions/events?search=bitcoin&locale=en'))

    expect(response.status).toBe(200)
    expect(mocks.loadOpenRouterProviderSettings).toHaveBeenCalled()
    expect(mocks.hasTradingActivity).not.toHaveBeenCalled()
    expect(mocks.rankCandidatesWithDecisionModel).not.toHaveBeenCalled()
  })

  it('reranks only the first page for users with trading activity', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.hasTradingActivity.mockResolvedValue(true)
    mocks.loadOpenRouterProviderSettings.mockResolvedValue({
      apiKey: 'openrouter-key',
      decisionModel: 'typesafe/jev-1.13',
    })
    const cacheKeys: string[] = []
    mocks.rankCandidatesWithDecisionModel.mockImplementation(
      async ({
        candidates,
        beforeRequest,
        cacheKey,
      }: {
        candidates: unknown[]
        beforeRequest?: () => Promise<boolean>
        cacheKey?: string
      }) => {
        await beforeRequest?.()
        if (cacheKey) {
          cacheKeys.push(cacheKey)
        }
        return [candidates[1], candidates[0]]
      },
    )

    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
    ]
    mocks.listPredictionResultsPage.mockResolvedValueOnce({ data: events, error: null })

    const firstPageResponse = await GET(
      new Request('https://example.com/api/predictions/events?search=bitcoin&locale=en&offset=0'),
    )

    expect(firstPageResponse.status).toBe(200)
    expect(mocks.hasTradingActivity).toHaveBeenCalledWith('user-1')
    expect(mocks.loadOpenRouterProviderSettings).toHaveBeenCalled()
    await expect(firstPageResponse.json()).resolves.toEqual([events[1], events[0]])
    expect(mocks.consumeDecisionModelSearchQuota).toHaveBeenCalledWith('user-1')
    expect(mocks.rankCandidatesWithDecisionModel).toHaveBeenCalledTimes(1)
    expect(cacheKeys[0]).toContain('user-1')

    mocks.listPredictionResultsPage.mockResolvedValueOnce({ data: events, error: null })

    const nextPageResponse = await GET(
      new Request('https://example.com/api/predictions/events?search=bitcoin&locale=en&offset=32'),
    )

    expect(nextPageResponse.status).toBe(200)
    await expect(nextPageResponse.json()).resolves.toEqual(events)
    expect(mocks.hasTradingActivity).toHaveBeenCalledTimes(1)
    expect(mocks.rankCandidatesWithDecisionModel).toHaveBeenCalledTimes(1)
  })
})

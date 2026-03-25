import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listHomeEventsPage: vi.fn(),
  listEvents: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/db/queries/event', () => ({
  EventRepository: {
    listEvents: (...args: any[]) => mocks.listEvents(...args),
  },
}))

vi.mock('@/lib/home-events-page', () => ({
  listHomeEventsPage: (...args: any[]) => mocks.listHomeEventsPage(...args),
}))

const { GET } = await import('@/app/api/events/route')

describe('events route', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.listHomeEventsPage.mockReset()
    mocks.listEvents.mockReset()
  })

  it('returns an empty payload for anonymous bookmarked requests', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const response = await GET(new Request('https://example.com/api/events?bookmarked=true&locale=en'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
    expect(mocks.listEvents).not.toHaveBeenCalled()
    expect(mocks.listHomeEventsPage).not.toHaveBeenCalled()
  })

  it('forwards mainTag to the events repository', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.listEvents.mockResolvedValueOnce({ data: [], error: null })

    const response = await GET(new Request('https://example.com/api/events?tag=ai&mainTag=tech&locale=en'))

    expect(response.status).toBe(200)
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'ai',
      mainTag: 'tech',
      userId: 'user-1',
    }))
  })

  it('forwards validated sort params to the home feed loader', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.listHomeEventsPage.mockResolvedValueOnce({ data: [], error: null })

    const response = await GET(new Request('https://example.com/api/events?homeFeed=true&sort=trending&locale=en'))

    expect(response.status).toBe(200)
    expect(mocks.listHomeEventsPage).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'trending',
    }))
  })
})

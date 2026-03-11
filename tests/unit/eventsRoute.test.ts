import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
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

const { GET } = await import('@/app/api/events/route')

describe('events route', () => {
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
})

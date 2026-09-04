import { describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  deleteById: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

void mock.module('@/lib/db/queries/notification', () => ({
  NotificationRepository: { deleteById: (...args: any[]) => mocks.deleteById(...args) },
}))

const { DELETE } = await import('@/app/api/notifications/[id]/route')

describe('notifications delete route', () => {
  it('returns 401 for unauthenticated user', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    const response = await DELETE(new Request('https://example.com') as any, { params: Promise.resolve({ id: '1' }) })
    expect(response.status).toBe(401)
  })

  it('returns 500 on repository error', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.deleteById.mockResolvedValueOnce({ error: { message: 'boom' } })
    const response = await DELETE(new Request('https://example.com') as any, { params: Promise.resolve({ id: '1' }) })
    expect(response.status).toBe(500)
  })

  it('returns success true on delete', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.deleteById.mockResolvedValueOnce({ error: null })
    const response = await DELETE(new Request('https://example.com') as any, { params: Promise.resolve({ id: '1' }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mocks.deleteById).toHaveBeenCalledWith('1', 'user-1')
  })
})

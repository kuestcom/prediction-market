import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/db/queries/allowed-market-creators', () => ({
  AllowedMarketCreatorRepository: {
    list: vi.fn(),
    upsertMany: vi.fn(),
    replaceSiteSource: vi.fn(),
    deleteBySourceUrl: vi.fn(),
    deleteByWallet: vi.fn(),
  },
}))

const { POST } = await import('@/app/[locale]/admin/api/event-creations/allowed-creators/route')

describe('allowed market creators route', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.getCurrentUser.mockReset()
  })

  it('rejects non-https site sources before fetching the remote allowlist', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await POST(new Request('https://example.com/admin/api/event-creations/allowed-creators', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceType: 'site',
        url: 'http://site2.com',
      }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Site URL must use https.',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPublicAssetUrl: vi.fn((path: string) => `https://assets.example/${path}`),
  getUserPublicAddress: vi.fn((user: { deposit_wallet_address?: string | null, address?: string | null }) => user.deposit_wallet_address || user.address || ''),
  searchPublicProfiles: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    searchPublicProfiles: (...args: any[]) => mocks.searchPublicProfiles(...args),
  },
}))

vi.mock('@/lib/storage', () => ({
  getPublicAssetUrl: (...args: any[]) => mocks.getPublicAssetUrl(...args),
}))

vi.mock('@/lib/user-address', () => ({
  getUserPublicAddress: (...args: any[]) => mocks.getUserPublicAddress(...args),
}))

const { GET } = await import('@/app/api/users/route')

describe('users route', () => {
  beforeEach(() => {
    mocks.getPublicAssetUrl.mockClear()
    mocks.getUserPublicAddress.mockClear()
    mocks.searchPublicProfiles.mockReset()
  })

  it('returns an empty payload for short profile search queries', async () => {
    const response = await GET(new Request('https://example.com/api/users?search=b'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
    expect(mocks.searchPublicProfiles).not.toHaveBeenCalled()
  })

  it('uses the public profile search path without requesting user counts', async () => {
    mocks.searchPublicProfiles.mockResolvedValueOnce({
      data: [
        {
          address: '0xabc',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          deposit_wallet_address: '0xwallet',
          image: 'avatar.png',
          username: 'bruno',
        },
      ],
      error: null,
    })

    const response = await GET(new Request('https://example.com/api/users?search=bruno'))

    expect(response.status).toBe(200)
    expect(mocks.searchPublicProfiles).toHaveBeenCalledWith({
      search: 'bruno',
      limit: 10,
    })
    await expect(response.json()).resolves.toEqual([
      {
        address: '0xwallet',
        created_at: '2026-01-01T00:00:00.000Z',
        deposit_wallet_address: '0xwallet',
        image: 'https://assets.example/avatar.png',
        username: 'bruno',
      },
    ])
  })
})

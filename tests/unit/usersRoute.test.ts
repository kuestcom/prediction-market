import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getPublicAssetUrl: mock((path: string) => `https://assets.example/${path}`),
  getUserPublicAddress: mock(
    (user: { deposit_wallet_address?: string | null; address?: string | null }) =>
      user.deposit_wallet_address || user.address || '',
  ),
  searchPublicProfiles: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: {
    searchPublicProfiles: mocks.searchPublicProfiles,
  },
}))

void mock.module('@/lib/storage', () => ({
  getPublicAssetUrl: mocks.getPublicAssetUrl,
}))

void mock.module('@/lib/user-address', () => ({
  getUserPublicAddress: mocks.getUserPublicAddress,
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

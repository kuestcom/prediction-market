import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchCommunityFollowLeaderboard,
  fetchCommunityFollowStatuses,
  fetchCommunityFollowStats,
  fetchCommunityFollowing,
  setCommunityFollow,
} from '@/lib/community-follows'

const WALLET_A = '0x1111111111111111111111111111111111111111'
const WALLET_B = '0x2222222222222222222222222222222222222222'

describe('community follows client', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses authenticated idempotent methods and sends no fork identity in the body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          wallet: WALLET_A,
          is_following: true,
          followers_count: 12,
          following_count: 4,
        }),
        { status: 200 },
      ),
    )

    await expect(
      setCommunityFollow({
        communityApiUrl: 'https://community.example',
        wallet: WALLET_A.toUpperCase(),
        token: 'token-1',
        following: true,
      }),
    ).resolves.toMatchObject({ wallet: WALLET_A, isFollowing: true, followersCount: 12, followingCount: 4 })
    expect(fetchMock).toHaveBeenCalledWith(new URL(`https://community.example/follows/${WALLET_A}`), {
      method: 'PUT',
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('requests many statuses in one call and fills omitted wallets safely', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ wallet: WALLET_A, isFollowing: true, followersCount: 7 }],
        }),
        { status: 200 },
      ),
    )

    await expect(
      fetchCommunityFollowStatuses({
        communityApiUrl: 'https://community.example',
        wallets: [WALLET_A, WALLET_B],
        token: 'token-1',
      }),
    ).resolves.toEqual([
      { wallet: WALLET_A, isFollowing: true, followersCount: 7, followingCount: 0, profile: null },
      { wallet: WALLET_B, isFollowing: false, followersCount: 0, followingCount: 0, profile: null },
    ])
    const url = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/follows/status')
    expect(url.searchParams.get('wallets')).toBe(`${WALLET_A},${WALLET_B}`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('normalizes stats and both cursor-paginated response formats', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ followers_count: 9, following_count: 3 })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ followed_wallet: WALLET_A, created_at: '2026-08-13T00:00:00Z', followers_count: 9 }],
            next_cursor: 'following-cursor',
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ followed_wallet: WALLET_B, followers_count: 8 }],
            nextCursor: 'leaderboard-cursor',
          }),
        ),
      )

    await expect(
      fetchCommunityFollowStats({ communityApiUrl: 'https://community.example', wallet: WALLET_A }),
    ).resolves.toEqual({ followersCount: 9, followingCount: 3 })
    await expect(
      fetchCommunityFollowing({ communityApiUrl: 'https://community.example', token: 'token-1' }),
    ).resolves.toMatchObject({ data: [{ wallet: WALLET_A, followersCount: 9 }], nextCursor: 'following-cursor' })
    await expect(
      fetchCommunityFollowLeaderboard({ communityApiUrl: 'https://community.example' }),
    ).resolves.toMatchObject({
      data: [{ wallet: WALLET_B, followersCount: 8 }],
      nextCursor: 'leaderboard-cursor',
    })
  })
})

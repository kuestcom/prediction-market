import { buildCommunityApiUrl } from '@/lib/community-url'

const WALLET_PATTERN = /^0x[0-9a-f]{40}$/i
export const COMMUNITY_FOLLOW_STATUS_BATCH_LIMIT = 100

export const communityFollowQueryKeys = {
  all: ['community-follows'] as const,
  statusRoot: (communityApiUrl: string) => ['community-follows', 'status', communityApiUrl] as const,
  status: (communityApiUrl: string, viewerWallet: string, wallets: readonly string[]) =>
    ['community-follows', 'status', communityApiUrl, viewerWallet, wallets] as const,
  following: (communityApiUrl: string, viewerWallet: string) =>
    ['community-follows', 'following', communityApiUrl, viewerWallet] as const,
  stats: (communityApiUrl: string, wallet: string) => ['community-follows', 'stats', communityApiUrl, wallet] as const,
  leaderboard: (communityApiUrl: string) => ['community-follows', 'leaderboard', communityApiUrl] as const,
}

export interface CommunityFollowPublicProfile {
  id: string | null
  username: string | null
  avatarUrl: string | null
  wallet: string
  walletAddress: string | null
  depositWalletAddress: string | null
}

export interface CommunityFollowStatus {
  wallet: string
  isFollowing: boolean
  followersCount: number
  followingCount: number
  profile: CommunityFollowPublicProfile | null
}

export type CommunityFollowMutationResult = CommunityFollowStatus

export interface CommunityFollowStats {
  followersCount: number
  followingCount: number
}

export interface CommunityFollowingItem {
  wallet: string
  followedAt: string
  followersCount: number
  followingCount: number
  profile: CommunityFollowPublicProfile | null
}

export interface CommunityFollowLeaderboardItem {
  wallet: string
  followersCount: number
  followingCount: number
  volume: number
  pnl: number
  profile: CommunityFollowPublicProfile | null
}

export interface CommunityCursorPage<T> {
  data: T[]
  nextCursor: string | null
}

export class CommunityFollowRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CommunityFollowRequestError'
    this.status = status
  }
}

function normalizeWallet(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return WALLET_PATTERN.test(normalized) ? normalized : null
}

function normalizeCount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

function normalizeMetric(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readField(payload: Record<string, unknown>, camel: string, snake: string) {
  return payload[camel] ?? payload[snake]
}

function unwrapObject(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  const record = payload as Record<string, unknown>
  const nested = record.data
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? (nested as Record<string, unknown>) : record
}

function mapProfile(payload: unknown, fallbackWallet: string): CommunityFollowPublicProfile | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  const profile = payload as Record<string, unknown>
  const wallet =
    normalizeWallet(readField(profile, 'wallet', 'deposit_wallet_address')) ??
    normalizeWallet(profile.depositWalletAddress) ??
    normalizeWallet(profile.walletAddress) ??
    normalizeWallet(profile.address) ??
    fallbackWallet
  const username = typeof profile.username === 'string' && profile.username.trim() ? profile.username.trim() : null
  const avatarValue = readField(profile, 'avatarUrl', 'avatar_url')
  const avatarUrl = typeof avatarValue === 'string' && avatarValue.trim() ? avatarValue.trim() : null
  const id = typeof profile.id === 'string' && profile.id.trim() ? profile.id.trim() : null
  return {
    id,
    username,
    avatarUrl,
    wallet,
    walletAddress: normalizeWallet(profile.walletAddress) ?? normalizeWallet(profile.wallet_address),
    depositWalletAddress:
      normalizeWallet(profile.depositWalletAddress) ?? normalizeWallet(profile.deposit_wallet_address),
  }
}

function mapStatus(payload: unknown, fallbackWallet?: string): CommunityFollowStatus | null {
  const record = unwrapObject(payload)
  const wallet =
    normalizeWallet(readField(record ?? {}, 'wallet', 'followed_wallet')) ?? normalizeWallet(fallbackWallet)
  if (!record || !wallet) {
    return null
  }

  return {
    wallet,
    isFollowing: Boolean(readField(record, 'isFollowing', 'is_following')),
    followersCount: normalizeCount(readField(record, 'followersCount', 'followers_count')),
    followingCount: normalizeCount(readField(record, 'followingCount', 'following_count')),
    profile: mapProfile(record.profile, wallet),
  }
}

async function parseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null)
  const record = unwrapObject(payload)
  const message = typeof record?.error === 'string' && record.error.trim() ? record.error.trim() : fallback
  return new CommunityFollowRequestError(message, response.status)
}

async function requestJson(url: string | URL, init?: RequestInit) {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw await parseError(response, 'Community follow request failed.')
  }
  return await response.json().catch(() => null)
}

function bearerHeaders(token?: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export async function setCommunityFollow({
  communityApiUrl,
  wallet,
  token,
  following,
}: {
  communityApiUrl: string
  wallet: string
  token: string
  following: boolean
}): Promise<CommunityFollowMutationResult> {
  const normalizedWallet = normalizeWallet(wallet)
  if (!normalizedWallet) {
    throw new Error('Invalid follow wallet.')
  }

  const payload = await requestJson(buildCommunityApiUrl(communityApiUrl, `/follows/${normalizedWallet}`), {
    method: following ? 'PUT' : 'DELETE',
    headers: bearerHeaders(token),
  })
  const status = mapStatus(payload, normalizedWallet)
  if (!status) {
    throw new Error('Community follow response is invalid.')
  }
  return status
}

export async function fetchCommunityFollowStatuses({
  communityApiUrl,
  wallets,
  token,
  signal,
}: {
  communityApiUrl: string
  wallets: string[]
  token?: string | null
  signal?: AbortSignal
}): Promise<CommunityFollowStatus[]> {
  const normalizedWallets = Array.from(
    new Set(wallets.map(normalizeWallet).filter((wallet): wallet is string => Boolean(wallet))),
  ).slice(0, COMMUNITY_FOLLOW_STATUS_BATCH_LIMIT)
  if (normalizedWallets.length === 0) {
    return []
  }

  const url = new URL(buildCommunityApiUrl(communityApiUrl, '/follows/status'))
  url.searchParams.set('wallets', normalizedWallets.join(','))
  const payload = await requestJson(url.toString(), { headers: bearerHeaders(token), signal })
  const record = unwrapObject(payload)
  const rawRows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown> | null)?.data)
      ? ((payload as Record<string, unknown>).data as unknown[])
      : Array.isArray(record?.items)
        ? record.items
        : []
  const statuses = new Map<string, CommunityFollowStatus>()
  rawRows.forEach((row) => {
    const status = mapStatus(row)
    if (status) {
      statuses.set(status.wallet, status)
    }
  })

  return normalizedWallets.map(
    (wallet) =>
      statuses.get(wallet) ?? {
        wallet,
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
        profile: null,
      },
  )
}

export async function fetchCommunityFollowStats({
  communityApiUrl,
  wallet,
  signal,
}: {
  communityApiUrl: string
  wallet: string
  signal?: AbortSignal
}): Promise<CommunityFollowStats> {
  const normalizedWallet = normalizeWallet(wallet)
  if (!normalizedWallet) {
    throw new Error('Invalid follow wallet.')
  }
  const url = new URL(buildCommunityApiUrl(communityApiUrl, '/follows/stats'))
  url.searchParams.set('wallet', normalizedWallet)
  const record = unwrapObject(await requestJson(url.toString(), { signal }))
  if (!record) {
    throw new Error('Community follow stats response is invalid.')
  }
  return {
    followersCount: normalizeCount(readField(record, 'followersCount', 'followers_count')),
    followingCount: normalizeCount(readField(record, 'followingCount', 'following_count')),
  }
}

async function fetchCursorPage<T>({
  url,
  token,
  signal,
  mapItem,
}: {
  url: URL
  token?: string | null
  signal?: AbortSignal
  mapItem: (item: unknown) => T | null
}): Promise<CommunityCursorPage<T>> {
  const payload = await requestJson(url.toString(), { headers: bearerHeaders(token), signal })
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
  const rawItems = Array.isArray(record.data) ? record.data : Array.isArray(record.items) ? record.items : []
  const cursor = readField(record, 'nextCursor', 'next_cursor')
  return {
    data: rawItems.map(mapItem).filter((item): item is T => item !== null),
    nextCursor: typeof cursor === 'string' && cursor ? cursor : null,
  }
}

export async function fetchCommunityFollowing({
  communityApiUrl,
  token,
  cursor,
  limit = 50,
  signal,
}: {
  communityApiUrl: string
  token: string
  cursor?: string | null
  limit?: number
  signal?: AbortSignal
}) {
  const url = new URL(buildCommunityApiUrl(communityApiUrl, '/follows'))
  url.searchParams.set('limit', String(limit))
  if (cursor) {
    url.searchParams.set('cursor', cursor)
  }
  return await fetchCursorPage<CommunityFollowingItem>({
    url,
    token,
    signal,
    mapItem(item) {
      const record = unwrapObject(item)
      const wallet = normalizeWallet(readField(record ?? {}, 'wallet', 'followed_wallet'))
      if (!record || !wallet) {
        return null
      }
      const followedAt = readField(record, 'followedAt', 'created_at') ?? record.createdAt
      return {
        wallet,
        followedAt: typeof followedAt === 'string' ? followedAt : '',
        followersCount: normalizeCount(readField(record, 'followersCount', 'followers_count')),
        followingCount: normalizeCount(readField(record, 'followingCount', 'following_count')),
        profile: mapProfile(record.profile, wallet),
      }
    },
  })
}

export async function fetchCommunityFollowLeaderboard({
  communityApiUrl,
  cursor,
  limit = 50,
  signal,
}: {
  communityApiUrl: string
  cursor?: string | null
  limit?: number
  signal?: AbortSignal
}) {
  const url = new URL(buildCommunityApiUrl(communityApiUrl, '/follows/leaderboard'))
  url.searchParams.set('limit', String(limit))
  if (cursor) {
    url.searchParams.set('cursor', cursor)
  }
  return await fetchCursorPage<CommunityFollowLeaderboardItem>({
    url,
    signal,
    mapItem(item) {
      const record = unwrapObject(item)
      const wallet = normalizeWallet(readField(record ?? {}, 'wallet', 'followed_wallet'))
      if (!record || !wallet) {
        return null
      }
      return {
        wallet,
        followersCount: normalizeCount(readField(record, 'followersCount', 'followers_count')),
        followingCount: normalizeCount(readField(record, 'followingCount', 'following_count')),
        volume: normalizeMetric(record.volume),
        pnl: normalizeMetric(record.pnl),
        profile: mapProfile(record.profile, wallet),
      }
    },
  })
}

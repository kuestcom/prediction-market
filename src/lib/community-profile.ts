import { buildCommunityApiUrl } from '@/lib/community-url'

export const COMMUNITY_PROFILE_LOOKUP_TIMEOUT_MS = 8_000

export interface CommunityProfile {
  id?: string
  address?: string
  username?: string
  avatar_url?: string
  deposit_wallet_address?: string
  created_at?: string
}

export async function fetchCommunityProfileByAddress({
  communityApiUrl,
  address,
  signal,
}: {
  communityApiUrl: string
  address: string
  signal?: AbortSignal
}): Promise<CommunityProfile | null> {
  const url = buildCommunityApiUrl(communityApiUrl, '/profile')
  url.searchParams.set('address', address)
  return await fetchCommunityProfile(url, signal)
}

export async function fetchCommunityProfileByUsername({
  communityApiUrl,
  username,
  signal,
}: {
  communityApiUrl: string
  username: string
  signal?: AbortSignal
}): Promise<CommunityProfile | null> {
  const url = buildCommunityApiUrl(communityApiUrl, '/profile')
  url.searchParams.set('username', username)
  return await fetchCommunityProfile(url, signal)
}

async function fetchCommunityProfile(url: URL, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error('Failed to load community profile.')
  }

  return await response.json() as CommunityProfile
}

export async function updateCommunityProfile({
  communityApiUrl,
  token,
  username,
  image,
}: {
  communityApiUrl: string
  token: string
  username?: string
  image?: File | null
}) {
  const communityForm = new FormData()
  const trimmedUsername = username?.trim()
  if (trimmedUsername) {
    communityForm.append('username', trimmedUsername)
  }
  if (image) {
    communityForm.append('image', image)
  }

  return await fetch(buildCommunityApiUrl(communityApiUrl, '/profile'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: communityForm,
  })
}
